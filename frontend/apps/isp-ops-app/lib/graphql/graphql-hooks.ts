/**
 * GraphQL Custom Hooks
 *
 * React hooks for GraphQL queries with automatic caching and polling
 * Uses Apollo Client for GraphQL operations
 */

import { useQuery, useLazyQuery, QueryHookOptions, LazyQueryHookOptions } from "@apollo/client";
import {
  GET_TENANT_METRICS,
  GET_TENANT,
  GET_TENANTS,
  GET_PAYMENT_METRICS,
  GET_PAYMENT,
  GET_PAYMENTS,
  GET_CUSTOMER_METRICS,
  GET_CUSTOMER,
  GET_CUSTOMERS,
  GET_DASHBOARD_DATA,
} from "./queries";

// ============================================================================
// Tenant Hooks
// ============================================================================

export const useTenantMetrics = (options?: QueryHookOptions) => {
  return useQuery(GET_TENANT_METRICS, {
    ...options,
    fetchPolicy: "cache-and-network",
    pollInterval: options?.pollInterval || 60000, // Auto-refresh every 60s
  });
};

export const useTenant = (
  id: string,
  options?: QueryHookOptions & {
    includeMetadata?: boolean;
    includeSettings?: boolean;
    includeUsage?: boolean;
    includeInvitations?: boolean;
  },
) => {
  return useQuery(GET_TENANT, {
    ...options,
    variables: {
      id,
      includeMetadata: options?.includeMetadata || false,
      includeSettings: options?.includeSettings || false,
      includeUsage: options?.includeUsage || false,
      includeInvitations: options?.includeInvitations || false,
    },
    skip: !id,
  });
};

export const useTenants = (
  options?: QueryHookOptions & {
    page?: number;
    pageSize?: number;
    status?: string;
    plan?: string;
    search?: string;
    includeMetadata?: boolean;
    includeSettings?: boolean;
    includeUsage?: boolean;
  },
) => {
  return useQuery(GET_TENANTS, {
    ...options,
    variables: {
      page: options?.page || 1,
      pageSize: options?.pageSize || 20,
      status: options?.status,
      plan: options?.plan,
      search: options?.search,
      includeMetadata: options?.includeMetadata || false,
      includeSettings: options?.includeSettings || false,
      includeUsage: options?.includeUsage || false,
    },
    fetchPolicy: "cache-and-network",
  });
};

export const useLazyTenant = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_TENANT, options);
};

export const useLazyTenants = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_TENANTS, options);
};

// ============================================================================
// Payment Hooks
// ============================================================================

export const usePaymentMetrics = (
  options?: QueryHookOptions & {
    dateFrom?: string;
    dateTo?: string;
  },
) => {
  return useQuery(GET_PAYMENT_METRICS, {
    ...options,
    variables: {
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
    },
    fetchPolicy: "cache-and-network",
    pollInterval: options?.pollInterval || 300000, // Auto-refresh every 5 minutes
  });
};

export const usePayment = (
  id: string,
  options?: QueryHookOptions & {
    includeCustomer?: boolean;
    includeInvoice?: boolean;
  },
) => {
  return useQuery(GET_PAYMENT, {
    ...options,
    variables: {
      id,
      includeCustomer: options?.includeCustomer || false,
      includeInvoice: options?.includeInvoice || false,
    },
    skip: !id,
  });
};

export const usePayments = (
  options?: QueryHookOptions & {
    limit?: number;
    offset?: number;
    status?: string;
    customerId?: string;
    dateFrom?: string;
    dateTo?: string;
    includeCustomer?: boolean;
  },
) => {
  return useQuery(GET_PAYMENTS, {
    ...options,
    variables: {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      status: options?.status,
      customerId: options?.customerId,
      dateFrom: options?.dateFrom,
      dateTo: options?.dateTo,
      includeCustomer: options?.includeCustomer || false,
    },
    fetchPolicy: "cache-and-network",
  });
};

export const useLazyPayment = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_PAYMENT, options);
};

export const useLazyPayments = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_PAYMENTS, options);
};

// ============================================================================
// Customer Hooks
// ============================================================================

export const useCustomerMetrics = (options?: QueryHookOptions) => {
  return useQuery(GET_CUSTOMER_METRICS, {
    ...options,
    fetchPolicy: "cache-and-network",
    pollInterval: options?.pollInterval || 60000, // Auto-refresh every 60s
  });
};

export const useCustomer = (
  id: string,
  options?: QueryHookOptions & {
    includeActivities?: boolean;
    includeNotes?: boolean;
  },
) => {
  return useQuery(GET_CUSTOMER, {
    ...options,
    variables: {
      id,
      includeActivities: options?.includeActivities || false,
      includeNotes: options?.includeNotes || false,
    },
    skip: !id,
  });
};

export const useCustomers = (
  options?: QueryHookOptions & {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
    includeActivities?: boolean;
  },
) => {
  return useQuery(GET_CUSTOMERS, {
    ...options,
    variables: {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      status: options?.status,
      search: options?.search,
      includeActivities: options?.includeActivities || false,
    },
    fetchPolicy: "cache-and-network",
  });
};

export const useLazyCustomer = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_CUSTOMER, options);
};

export const useLazyCustomers = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_CUSTOMERS, options);
};

// ============================================================================
// Dashboard Hook
// ============================================================================

export const useDashboardData = (options?: QueryHookOptions) => {
  return useQuery(GET_DASHBOARD_DATA, {
    ...options,
    fetchPolicy: "cache-and-network",
    pollInterval: options?.pollInterval || 30000, // Auto-refresh every 30s for dashboard
  });
};

export const useLazyDashboardData = (options?: LazyQueryHookOptions) => {
  return useLazyQuery(GET_DASHBOARD_DATA, options);
};
