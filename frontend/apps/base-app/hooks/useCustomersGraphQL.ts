/**
 * GraphQL Wrapper Hooks for Customer Management
 *
 * These hooks provide a convenient interface for customer management components,
 * wrapping the auto-generated GraphQL hooks with consistent error handling
 * and data transformation.
 *
 * Benefits:
 * - 66% fewer HTTP requests (3 calls → 1 query)
 * - Batched activities and notes loading
 * - Conditional field loading
 * - Type-safe with auto-generated types
 */

import {
  useCustomerListQuery,
  useCustomerDetailQuery,
  useCustomerMetricsQuery,
  useCustomerActivitiesQuery,
  useCustomerNotesQuery,
  useCustomerDashboardQuery,
  // TODO: Add 360° view queries to customers.graphql
  // useCustomerSubscriptionsQuery,
  // useCustomerNetworkInfoQuery,
  // useCustomerDevicesQuery,
  // useCustomerTicketsQuery,
  // useCustomerBillingQuery,
  // useCustomer360ViewQuery,
  CustomerStatusEnum,
} from '@/lib/graphql/generated';

// ============================================================================
// Customer List Hook
// ============================================================================

export interface UseCustomerListOptions {
  limit?: number;
  offset?: number;
  status?: CustomerStatusEnum;
  search?: string;
  includeActivities?: boolean;
  includeNotes?: boolean;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCustomerListGraphQL(options: UseCustomerListOptions = {}) {
  const {
    limit = 50,
    offset = 0,
    status,
    search,
    includeActivities = false,
    includeNotes = false,
    enabled = true,
    pollInterval = 30000, // 30 seconds default
  } = options;

  const { data, loading, error, refetch } = useCustomerListQuery({
    variables: {
      limit,
      offset,
      status,
      search: search || undefined,
      includeActivities,
      includeNotes,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  const customers = data?.customers?.customers ?? [];
  const totalCount = data?.customers?.totalCount ?? 0;
  const hasNextPage = data?.customers?.hasNextPage ?? false;

  return {
    customers,
    total: totalCount,
    hasNextPage,
    limit,
    offset,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Detail Hook
// ============================================================================

export interface UseCustomerDetailOptions {
  customerId: string;
  enabled?: boolean;
}

export function useCustomerDetailGraphQL(options: UseCustomerDetailOptions) {
  const { customerId, enabled = true } = options;

  const { data, loading, error, refetch } = useCustomerDetailQuery({
    variables: { id: customerId },
    skip: !enabled || !customerId,
    fetchPolicy: 'cache-and-network',
  });

  const customer = data?.customer ?? null;

  return {
    customer,
    activities: customer?.activities ?? [],
    notes: customer?.notes ?? [],
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Metrics Hook
// ============================================================================

export interface UseCustomerMetricsOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useCustomerMetricsGraphQL(options: UseCustomerMetricsOptions = {}) {
  const { enabled = true, pollInterval = 60000 } = options; // 60 seconds default

  const { data, loading, error, refetch } = useCustomerMetricsQuery({
    skip: !enabled,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  const metrics = data?.customerMetrics;

  return {
    metrics: {
      totalCustomers: metrics?.totalCustomers ?? 0,
      activeCustomers: metrics?.activeCustomers ?? 0,
      newCustomers: metrics?.newCustomers ?? 0,
      churnedCustomers: metrics?.churnedCustomers ?? 0,
      totalCustomerValue: metrics?.totalCustomerValue ?? 0,
      averageCustomerValue: metrics?.averageCustomerValue ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Activities Hook (Lightweight)
// ============================================================================

export interface UseCustomerActivitiesOptions {
  customerId: string;
  enabled?: boolean;
}

export function useCustomerActivitiesGraphQL(options: UseCustomerActivitiesOptions) {
  const { customerId, enabled = true } = options;

  const { data, loading, error, refetch } = useCustomerActivitiesQuery({
    variables: { id: customerId },
    skip: !enabled || !customerId,
    fetchPolicy: 'cache-and-network',
  });

  const customer = data?.customer ?? null;
  const activities = customer?.activities ?? [];

  return {
    customerId: customer?.id,
    activities,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Notes Hook (Lightweight)
// ============================================================================

export interface UseCustomerNotesOptions {
  customerId: string;
  enabled?: boolean;
}

export function useCustomerNotesGraphQL(options: UseCustomerNotesOptions) {
  const { customerId, enabled = true } = options;

  const { data, loading, error, refetch } = useCustomerNotesQuery({
    variables: { id: customerId },
    skip: !enabled || !customerId,
    fetchPolicy: 'cache-and-network',
  });

  const customer = data?.customer ?? null;
  const notes = customer?.notes ?? [];

  return {
    customerId: customer?.id,
    notes,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Dashboard Hook (Combined)
// ============================================================================

export interface UseCustomerDashboardOptions {
  limit?: number;
  offset?: number;
  status?: CustomerStatusEnum;
  search?: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCustomerDashboardGraphQL(options: UseCustomerDashboardOptions = {}) {
  const {
    limit = 20,
    offset = 0,
    status,
    search,
    enabled = true,
    pollInterval = 30000,
  } = options;

  const { data, loading, error, refetch } = useCustomerDashboardQuery({
    variables: {
      limit,
      offset,
      status,
      search: search || undefined,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  const customers = data?.customers?.customers ?? [];
  const totalCount = data?.customers?.totalCount ?? 0;
  const hasNextPage = data?.customers?.hasNextPage ?? false;
  const metrics = data?.customerMetrics;

  return {
    customers,
    total: totalCount,
    hasNextPage,
    metrics: {
      totalCustomers: metrics?.totalCustomers ?? 0,
      activeCustomers: metrics?.activeCustomers ?? 0,
      newCustomers: metrics?.newCustomers ?? 0,
      churnedCustomers: metrics?.churnedCustomers ?? 0,
      totalCustomerValue: metrics?.totalCustomerValue ?? 0,
      averageCustomerValue: metrics?.averageCustomerValue ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer 360° View Hooks
// ============================================================================
// TODO: These hooks require additional GraphQL queries to be added to customers.graphql
// Uncomment and implement once the backend queries are available

// ============================================================================
// Customer Subscriptions Hook
// ============================================================================

/*
export interface UseCustomerSubscriptionsOptions {
  customerId: string;
  enabled?: boolean;
}

export function useCustomerSubscriptionsGraphQL(options: UseCustomerSubscriptionsOptions) {
  const { customerId, enabled = true } = options;

  const { data, loading, error, refetch } = useCustomerSubscriptionsQuery({
    variables: { customerId },
    skip: !enabled || !customerId,
    fetchPolicy: 'cache-and-network',
  });

  const subscriptionData = data?.customerSubscriptions ?? null;

  return {
    currentSubscription: subscriptionData?.currentSubscription ?? null,
    subscriptionHistory: subscriptionData?.subscriptionHistory ?? [],
    totalSubscriptions: subscriptionData?.totalSubscriptions ?? 0,
    activeSubscriptions: subscriptionData?.activeSubscriptions ?? 0,
    totalRevenue: subscriptionData?.totalRevenue ?? 0,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}
*/

/*
// ============================================================================
// Customer Network Info Hook
// ============================================================================

export interface UseCustomerNetworkInfoOptions {
  customerId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCustomerNetworkInfoGraphQL(options: UseCustomerNetworkInfoOptions) {
  const { customerId, enabled = true, pollInterval = 30000 } = options; // 30 seconds default

  const { data, loading, error, refetch } = useCustomerNetworkInfoQuery({
    variables: { customerId },
    skip: !enabled || !customerId,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  const networkInfo = data?.customerNetworkInfo ?? null;

  return {
    networkInfo,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Devices Hook
// ============================================================================

export interface UseCustomerDevicesOptions {
  customerId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCustomerDevicesGraphQL(options: UseCustomerDevicesOptions) {
  const { customerId, enabled = true, pollInterval = 60000 } = options; // 60 seconds default

  const { data, loading, error, refetch } = useCustomerDevicesQuery({
    variables: { customerId },
    skip: !enabled || !customerId,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  const deviceData = data?.customerDevices ?? null;

  return {
    devices: deviceData?.devices ?? [],
    totalDevices: deviceData?.totalDevices ?? 0,
    onlineDevices: deviceData?.onlineDevices ?? 0,
    offlineDevices: deviceData?.offlineDevices ?? 0,
    needingUpdates: deviceData?.needingUpdates ?? 0,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Tickets Hook
// ============================================================================

export interface UseCustomerTicketsOptions {
  customerId: string;
  limit?: number;
  offset?: number;
  status?: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCustomerTicketsGraphQL(options: UseCustomerTicketsOptions) {
  const {
    customerId,
    limit = 50,
    offset = 0,
    status,
    enabled = true,
    pollInterval = 60000,
  } = options;

  const { data, loading, error, refetch } = useCustomerTicketsQuery({
    variables: {
      customerId,
      limit,
      offset,
      status,
    },
    skip: !enabled || !customerId,
    pollInterval,
    fetchPolicy: 'cache-and-network',
  });

  const ticketData = data?.customerTickets ?? null;

  return {
    tickets: ticketData?.tickets ?? [],
    totalCount: ticketData?.totalCount ?? 0,
    openCount: ticketData?.openCount ?? 0,
    closedCount: ticketData?.closedCount ?? 0,
    criticalCount: ticketData?.criticalCount ?? 0,
    highCount: ticketData?.highCount ?? 0,
    overdueCount: ticketData?.overdueCount ?? 0,
    hasNextPage: ticketData?.hasNextPage ?? false,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer Billing Hook
// ============================================================================

export interface UseCustomerBillingOptions {
  customerId: string;
  limit?: number;
  enabled?: boolean;
}

export function useCustomerBillingGraphQL(options: UseCustomerBillingOptions) {
  const { customerId, limit = 50, enabled = true } = options;

  const { data, loading, error, refetch } = useCustomerBillingQuery({
    variables: { customerId, limit },
    skip: !enabled || !customerId,
    fetchPolicy: 'cache-and-network',
  });

  const billingData = data?.customerBilling ?? null;

  return {
    summary: billingData?.summary ?? null,
    invoices: billingData?.invoices ?? [],
    payments: billingData?.payments ?? [],
    totalInvoices: billingData?.totalInvoices ?? 0,
    paidInvoices: billingData?.paidInvoices ?? 0,
    unpaidInvoices: billingData?.unpaidInvoices ?? 0,
    overdueInvoices: billingData?.overdueInvoices ?? 0,
    totalPayments: billingData?.totalPayments ?? 0,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Customer 360° Complete View Hook
// ============================================================================

export interface UseCustomer360ViewOptions {
  customerId: string;
  enabled?: boolean;
}

export function useCustomer360ViewGraphQL(options: UseCustomer360ViewOptions) {
  const { customerId, enabled = true } = options;

  const { data, loading, error, refetch } = useCustomer360ViewQuery({
    variables: { customerId },
    skip: !enabled || !customerId,
    fetchPolicy: 'cache-and-network',
  });

  return {
    customer: data?.customer ?? null,
    subscriptions: {
      current: data?.customerSubscriptions?.currentSubscription ?? null,
      total: data?.customerSubscriptions?.totalSubscriptions ?? 0,
      active: data?.customerSubscriptions?.activeSubscriptions ?? 0,
    },
    network: data?.customerNetworkInfo ?? null,
    devices: {
      total: data?.customerDevices?.totalDevices ?? 0,
      online: data?.customerDevices?.onlineDevices ?? 0,
      offline: data?.customerDevices?.offlineDevices ?? 0,
    },
    tickets: {
      open: data?.customerTickets?.openCount ?? 0,
      closed: data?.customerTickets?.closedCount ?? 0,
      critical: data?.customerTickets?.criticalCount ?? 0,
    },
    billing: {
      summary: data?.customerBilling?.summary ?? null,
      totalInvoices: data?.customerBilling?.totalInvoices ?? 0,
      unpaidInvoices: data?.customerBilling?.unpaidInvoices ?? 0,
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}
*/

// ============================================================================
// Export All Hooks
// ============================================================================

export const CustomerGraphQLHooks = {
  useCustomerListGraphQL,
  useCustomerDetailGraphQL,
  useCustomerMetricsGraphQL,
  useCustomerActivitiesGraphQL,
  useCustomerNotesGraphQL,
  useCustomerDashboardGraphQL,
  // 360° view hooks commented out until queries are implemented
  // useCustomerSubscriptionsGraphQL,
  // useCustomerNetworkInfoGraphQL,
  // useCustomerDevicesGraphQL,
  // useCustomerTicketsGraphQL,
  // useCustomerBillingGraphQL,
  // useCustomer360ViewGraphQL,
};
