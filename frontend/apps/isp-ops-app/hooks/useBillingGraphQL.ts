/**
 * Billing & Subscriptions GraphQL Hooks
 *
 * React Query hooks for billing, subscriptions, and revenue metrics using GraphQL.
 * Provides unified billing metrics (MRR, ARR, revenue) and subscription management
 * with DataLoader batching for customer/plan/invoice data.
 */

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { graphqlClient } from "@/lib/graphql-client";

// ============================================================================
// Types
// ============================================================================

export enum SubscriptionStatus {
  ACTIVE = "active",
  TRIALING = "trialing",
  PAST_DUE = "past_due",
  CANCELED = "canceled",
  PAUSED = "paused",
  INCOMPLETE = "incomplete",
  INCOMPLETE_EXPIRED = "incomplete_expired",
}

export enum BillingCycle {
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUAL = "annual",
  LIFETIME = "lifetime",
}

export interface SubscriptionCustomer {
  id: string;
  name: string;
  email: string;
  customerNumber: string | null;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  trialDays: number | null;
  isActive: boolean;
}

export interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  dueDate: string | null;
}

export interface Subscription {
  id: string;
  customerId: string;
  customer: SubscriptionCustomer | null;
  planId: string;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
  canceledAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  recentInvoices: SubscriptionInvoice[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionConnection {
  subscriptions: Subscription[];
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  pageSize: number;
}

export interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  pausedSubscriptions: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  averageRevenuePerUser: number;
  newSubscriptionsThisMonth: number;
  newSubscriptionsLastMonth: number;
  churnRate: number;
  growthRate: number;
  monthlySubscriptions: number;
  quarterlySubscriptions: number;
  annualSubscriptions: number;
  trialConversionRate: number;
  activeTrials: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PlanConnection {
  plans: SubscriptionPlan[];
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  pageSize: number;
}

export interface ProductConnection {
  products: Product[];
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  pageSize: number;
}

export interface BillingMetrics {
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalPaymentAmount: number;
  period: string;
  timestamp: string;
}

export interface DashboardOverview {
  billing: BillingMetrics;
  customers: {
    totalCustomers: number;
    activeCustomers: number;
    newCustomers: number;
    churnedCustomers: number;
    customerGrowthRate: number;
    churnRate: number;
    retentionRate: number;
  };
  monitoring: {
    errorRate: number;
    criticalErrors: number;
    warningCount: number;
    totalRequests: number;
  };
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const SUBSCRIPTION_FRAGMENT = `
  id
  customerId
  planId
  status
  startDate
  endDate
  canceledAt
  currentPeriodStart
  currentPeriodEnd
  trialStart
  trialEnd
  createdAt
  updatedAt
`;

const SUBSCRIPTION_CUSTOMER_FRAGMENT = `
  customer {
    id
    name
    email
    customerNumber
  }
`;

const SUBSCRIPTION_PLAN_FRAGMENT = `
  plan {
    id
    name
    description
    price
    currency
    billingCycle
    trialDays
    isActive
  }
`;

const SUBSCRIPTION_INVOICES_FRAGMENT = `
  recentInvoices {
    id
    invoiceNumber
    totalAmount
    status
    dueDate
  }
`;

const GET_SUBSCRIPTION_QUERY = `
  query GetSubscription(
    $id: ID!
    $includeCustomer: Boolean!
    $includePlan: Boolean!
    $includeInvoices: Boolean!
  ) {
    subscription(
      id: $id
      includeCustomer: $includeCustomer
      includePlan: $includePlan
      includeInvoices: $includeInvoices
    ) {
      ${SUBSCRIPTION_FRAGMENT}
      ${SUBSCRIPTION_CUSTOMER_FRAGMENT}
      ${SUBSCRIPTION_PLAN_FRAGMENT}
      ${SUBSCRIPTION_INVOICES_FRAGMENT}
    }
  }
`;

const GET_SUBSCRIPTIONS_QUERY = `
  query GetSubscriptions(
    $page: Int
    $pageSize: Int
    $status: SubscriptionStatusEnum
    $billingCycle: BillingCycleEnum
    $search: String
    $includeCustomer: Boolean!
    $includePlan: Boolean!
    $includeInvoices: Boolean!
  ) {
    subscriptions(
      page: $page
      pageSize: $pageSize
      status: $status
      billingCycle: $billingCycle
      search: $search
      includeCustomer: $includeCustomer
      includePlan: $includePlan
      includeInvoices: $includeInvoices
    ) {
      subscriptions {
        ${SUBSCRIPTION_FRAGMENT}
        ${SUBSCRIPTION_CUSTOMER_FRAGMENT}
        ${SUBSCRIPTION_PLAN_FRAGMENT}
        ${SUBSCRIPTION_INVOICES_FRAGMENT}
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;

const GET_SUBSCRIPTION_METRICS_QUERY = `
  query GetSubscriptionMetrics {
    subscriptionMetrics {
      totalSubscriptions
      activeSubscriptions
      trialingSubscriptions
      pastDueSubscriptions
      canceledSubscriptions
      pausedSubscriptions
      monthlyRecurringRevenue
      annualRecurringRevenue
      averageRevenuePerUser
      newSubscriptionsThisMonth
      newSubscriptionsLastMonth
      churnRate
      growthRate
      monthlySubscriptions
      quarterlySubscriptions
      annualSubscriptions
      trialConversionRate
      activeTrials
    }
  }
`;

const GET_PLANS_QUERY = `
  query GetPlans(
    $page: Int
    $pageSize: Int
    $isActive: Boolean
    $billingCycle: BillingCycleEnum
  ) {
    plans(
      page: $page
      pageSize: $pageSize
      isActive: $isActive
      billingCycle: $billingCycle
    ) {
      plans {
        id
        name
        description
        price
        currency
        billingCycle
        trialDays
        isActive
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;

const GET_PRODUCTS_QUERY = `
  query GetProducts(
    $page: Int
    $pageSize: Int
    $isActive: Boolean
    $category: String
  ) {
    products(
      page: $page
      pageSize: $pageSize
      isActive: $isActive
      category: $category
    ) {
      products {
        id
        name
        description
        category
        isActive
        createdAt
      }
      totalCount
      hasNextPage
      hasPrevPage
      page
      pageSize
    }
  }
`;

const GET_BILLING_METRICS_QUERY = `
  query GetBillingMetrics($period: String) {
    billingMetrics(period: $period) {
      mrr
      arr
      activeSubscriptions
      totalInvoices
      paidInvoices
      overdueInvoices
      totalPayments
      successfulPayments
      failedPayments
      totalPaymentAmount
      period
      timestamp
    }
  }
`;

const GET_DASHBOARD_OVERVIEW_QUERY = `
  query GetDashboardOverview($period: String) {
    dashboardOverview(period: $period) {
      billing {
        mrr
        arr
        activeSubscriptions
        totalInvoices
        paidInvoices
        overdueInvoices
        totalPayments
        successfulPayments
        failedPayments
        totalPaymentAmount
        period
        timestamp
      }
      customers {
        totalCustomers
        activeCustomers
        newCustomers
        churnedCustomers
        customerGrowthRate
        churnRate
        retentionRate
        period
        timestamp
      }
      monitoring {
        errorRate
        criticalErrors
        warningCount
        totalRequests
        period
        timestamp
      }
    }
  }
`;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get a single subscription by ID with customer, plan, and invoice data
 */
export function useSubscription(
  subscriptionId: string,
  options: {
    includeCustomer?: boolean;
    includePlan?: boolean;
    includeInvoices?: boolean;
    enabled?: boolean;
  } = {},
): UseQueryResult<Subscription, Error> {
  const {
    includeCustomer = true,
    includePlan = true,
    includeInvoices = false,
    enabled = true,
  } = options;

  return useQuery({
    queryKey: ["subscription", subscriptionId, includeCustomer, includePlan, includeInvoices],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        subscription: Subscription;
      }>(GET_SUBSCRIPTION_QUERY, {
        id: subscriptionId,
        includeCustomer,
        includePlan,
        includeInvoices,
      });
      return response.subscription;
    },
    enabled: enabled && !!subscriptionId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get paginated list of subscriptions with optional filters
 *
 * Benefits:
 * - Unified customer + plan + invoices in single query
 * - DataLoader batching prevents N+1 queries
 * - Server-side filtering and pagination
 */
export function useSubscriptions(
  filters: {
    page?: number;
    pageSize?: number;
    status?: SubscriptionStatus;
    billingCycle?: BillingCycle;
    search?: string;
    includeCustomer?: boolean;
    includePlan?: boolean;
    includeInvoices?: boolean;
  } = {},
  enabled = true,
): UseQueryResult<SubscriptionConnection, Error> {
  const {
    page = 1,
    pageSize = 10,
    status,
    billingCycle,
    search,
    includeCustomer = true,
    includePlan = true,
    includeInvoices = false,
  } = filters;

  return useQuery({
    queryKey: ["subscriptions", filters],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        subscriptions: SubscriptionConnection;
      }>(GET_SUBSCRIPTIONS_QUERY, {
        page,
        pageSize,
        status,
        billingCycle,
        search,
        includeCustomer,
        includePlan,
        includeInvoices,
      });
      return response.subscriptions;
    },
    enabled,
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get subscription metrics including MRR, ARR, churn rate, and growth
 *
 * Provides comprehensive revenue and growth metrics:
 * - Monthly Recurring Revenue (MRR)
 * - Annual Recurring Revenue (ARR)
 * - Average Revenue Per User (ARPU)
 * - Churn rate and growth rate
 * - Trial conversion metrics
 */
export function useSubscriptionMetrics(enabled = true): UseQueryResult<SubscriptionMetrics, Error> {
  return useQuery({
    queryKey: ["subscription-metrics"],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        subscriptionMetrics: SubscriptionMetrics;
      }>(GET_SUBSCRIPTION_METRICS_QUERY);
      return response.subscriptionMetrics;
    },
    enabled,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get subscription plans with optional filters
 */
export function useBillingPlans(
  filters: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    billingCycle?: BillingCycle;
  } = {},
  enabled = true,
): UseQueryResult<PlanConnection, Error> {
  const { page = 1, pageSize = 20, isActive, billingCycle } = filters;

  return useQuery({
    queryKey: ["billing-plans", filters],
    queryFn: async () => {
      const response = await graphqlClient.request<{ plans: PlanConnection }>(GET_PLANS_QUERY, {
        page,
        pageSize,
        isActive,
        billingCycle,
      });
      return response.plans;
    },
    enabled,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get products from catalog
 */
export function useProducts(
  filters: {
    page?: number;
    pageSize?: number;
    isActive?: boolean;
    category?: string;
  } = {},
  enabled = true,
): UseQueryResult<ProductConnection, Error> {
  const { page = 1, pageSize = 20, isActive, category } = filters;

  return useQuery({
    queryKey: ["products", filters],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        products: ProductConnection;
      }>(GET_PRODUCTS_QUERY, {
        page,
        pageSize,
        isActive,
        category,
      });
      return response.products;
    },
    enabled,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get billing metrics including MRR, ARR, invoices, and payments
 *
 * This hook uses the analytics endpoint for cached metrics calculation
 */
export function useBillingMetrics(
  period = "30d",
  enabled = true,
): UseQueryResult<BillingMetrics, Error> {
  return useQuery({
    queryKey: ["billing-metrics", period],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        billingMetrics: BillingMetrics;
      }>(GET_BILLING_METRICS_QUERY, { period });
      return response.billingMetrics;
    },
    enabled,
    staleTime: 300000, // 5 minutes
  });
}

/**
 * Get complete dashboard overview in a single query
 *
 * This is the power of GraphQL - fetch all related data in one request
 * with parallel execution. Includes:
 * - Billing metrics (MRR, ARR, revenue)
 * - Customer metrics (growth, churn, retention)
 * - System monitoring metrics
 */
export function useDashboardOverview(
  period = "30d",
  enabled = true,
): UseQueryResult<DashboardOverview, Error> {
  return useQuery({
    queryKey: ["dashboard-overview", period],
    queryFn: async () => {
      const response = await graphqlClient.request<{
        dashboardOverview: DashboardOverview;
      }>(GET_DASHBOARD_OVERVIEW_QUERY, { period });
      return response.dashboardOverview;
    },
    enabled,
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // Auto-refresh every 10 minutes
  });
}

/**
 * Get active subscriptions only
 * Convenience hook for common filtering
 */
export function useActiveSubscriptions(
  options: {
    page?: number;
    pageSize?: number;
    includeCustomer?: boolean;
    includePlan?: boolean;
  } = {},
  enabled = true,
): UseQueryResult<SubscriptionConnection, Error> {
  return useSubscriptions(
    {
      ...options,
      status: SubscriptionStatus.ACTIVE,
    },
    enabled,
  );
}

/**
 * Get subscriptions for a specific customer
 * Convenience hook for customer detail pages
 */
export function useCustomerSubscriptions(
  customerId: string,
  enabled = true,
): UseQueryResult<SubscriptionConnection, Error> {
  return useSubscriptions(
    {
      search: customerId,
      includeCustomer: false, // Already know the customer
      includePlan: true,
      includeInvoices: true,
    },
    enabled && !!customerId,
  );
}

/**
 * Get active billing plans only
 * Convenience hook for signup/upgrade flows
 */
export function useActiveBillingPlans(
  billingCycle?: BillingCycle,
  enabled = true,
): UseQueryResult<PlanConnection, Error> {
  const planFilters = {
    isActive: true,
    pageSize: 100, // Get all active plans
    ...(billingCycle !== undefined && { billingCycle }),
  };

  return useBillingPlans(planFilters, enabled);
}
