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
  useCustomerSubscriptionsQuery,
  useCustomerNetworkInfoQuery,
  useCustomerDevicesQuery,
  useCustomerTicketsQuery,
  useCustomerBillingQuery,
  useCustomer360ViewQuery,
} from "@dotmac/graphql/generated/react-query";

import { CustomerStatusEnum } from "@dotmac/graphql/generated";

// ============================================================================
// Customer List Hook
// ============================================================================

export interface UseCustomerListOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: CustomerStatusEnum | undefined;
  search?: string | undefined;
  includeActivities?: boolean | undefined;
  includeNotes?: boolean | undefined;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
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

  const { data, isLoading, error, refetch } = useCustomerListQuery(
    {
      limit,
      offset,
      status,
      search: search || undefined,
      includeActivities,
      includeNotes,
    },
    {
      enabled,
      refetchInterval: pollInterval,
    },
  );

  const customers = data?.customers?.customers ?? [];
  const totalCount = data?.customers?.totalCount ?? 0;
  const hasNextPage = data?.customers?.hasNextPage ?? false;

  return {
    customers,
    total: totalCount,
    hasNextPage,
    limit,
    offset,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Customer Detail Hook
// ============================================================================

export interface UseCustomerDetailOptions {
  customerId: string;
  enabled?: boolean | undefined;
}

export function useCustomerDetailGraphQL(options: UseCustomerDetailOptions) {
  const { customerId, enabled = true } = options;

  const { data, isLoading, error, refetch } = useCustomerDetailQuery(
    { id: customerId },
    {
      enabled: enabled && !!customerId,
    },
  );

  const customer = data?.customer ?? null;

  return {
    customer,
    activities: customer?.activities ?? [],
    notes: customer?.notes ?? [],
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Customer Metrics Hook
// ============================================================================

export interface UseCustomerMetricsOptions {
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useCustomerMetricsGraphQL(options: UseCustomerMetricsOptions = {}) {
  const { enabled = true, pollInterval = 60000 } = options; // 60 seconds default

  const { data, isLoading, error, refetch } = useCustomerMetricsQuery(undefined, {
    enabled,
    refetchInterval: pollInterval,
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
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useCustomerActivitiesQuery(
    { id: customerId },
    {
      enabled: enabled && !!customerId,
    },
  );

  const customer = data?.customer ?? null;
  const activities = customer?.activities ?? [];

  return {
    customerId: customer?.id,
    activities,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useCustomerNotesQuery(
    { id: customerId },
    {
      enabled: enabled && !!customerId,
    },
  );

  const customer = data?.customer ?? null;
  const notes = customer?.notes ?? [];

  return {
    customerId: customer?.id,
    notes,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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
  const { limit = 20, offset = 0, status, search, enabled = true, pollInterval = 30000 } = options;

  const { data, isLoading, isFetching, error, refetch } = useCustomerDashboardQuery(
    {
      limit,
      offset,
      status,
      search: search || undefined,
    },
    {
      enabled,
      refetchInterval: pollInterval,
    },
  );

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
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Customer 360° View Hooks
// ============================================================================

// ============================================================================
// Customer Subscriptions Hook
// ============================================================================

export interface UseCustomerSubscriptionsOptions {
  customerId: string;
  enabled?: boolean;
}

export function useCustomerSubscriptionsGraphQL(options: UseCustomerSubscriptionsOptions) {
  const { customerId, enabled = true } = options;

  const { data, isLoading, error, refetch } = useCustomerSubscriptionsQuery(
    { customerId },
    {
      enabled: enabled && !!customerId,
    },
  );

  const subscriptions = data?.customerSubscriptions ?? [];

  // Find active subscriptions
  const activeSubscriptions = subscriptions.filter(
    (sub: any) => sub.status === "ACTIVE" || sub.status === "TRIALING",
  );
  const currentSubscription = activeSubscriptions[0] ?? null;

  return {
    subscriptions,
    currentSubscription,
    activeCount: activeSubscriptions.length,
    totalCount: subscriptions.length,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

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

  const { data, isLoading, error, refetch } = useCustomerNetworkInfoQuery(
    { customerId },
    {
      enabled: enabled && !!customerId,
      refetchInterval: pollInterval,
    },
  );

  const networkInfo = data?.customerNetworkInfo ?? null;

  return {
    networkInfo,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useCustomerDevicesQuery(
    { customerId },
    {
      enabled: enabled && !!customerId,
      refetchInterval: pollInterval,
    },
  );

  const deviceData = data?.customerDevices ?? null;

  return {
    devices: deviceData?.["devices"] ?? [],
    totalDevices: deviceData?.["totalDevices"] ?? 0,
    onlineDevices: deviceData?.["onlineDevices"] ?? 0,
    offlineDevices: deviceData?.["offlineDevices"] ?? 0,
    needingUpdates: deviceData?.["needingUpdates"] ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useCustomerTicketsQuery(
    {
      customerId,
      limit,
      status,
    },
    {
      enabled: enabled && !!customerId,
      refetchInterval: pollInterval,
    },
  );

  // customerTickets returns JSON scalar
  const ticketData = (data?.customerTickets as any) ?? {};

  return {
    tickets: ticketData?.tickets ?? [],
    totalCount: ticketData?.totalCount ?? 0,
    openCount: ticketData?.openCount ?? 0,
    closedCount: ticketData?.closedCount ?? 0,
    criticalCount: ticketData?.criticalCount ?? 0,
    highCount: ticketData?.highCount ?? 0,
    overdueCount: ticketData?.overdueCount ?? 0,
    hasNextPage: ticketData?.hasNextPage ?? false,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useCustomerBillingQuery(
    {
      customerId,
      includeInvoices: true,
      invoiceLimit: limit,
    },
    {
      enabled: enabled && !!customerId,
    },
  );

  // customerBilling returns JSON scalar
  const billingData = (data?.customerBilling as any) ?? {};

  return {
    summary: billingData?.summary ?? null,
    invoices: billingData?.invoices ?? [],
    payments: billingData?.payments ?? [],
    totalInvoices: billingData?.totalInvoices ?? 0,
    paidInvoices: billingData?.paidInvoices ?? 0,
    unpaidInvoices: billingData?.unpaidInvoices ?? 0,
    overdueInvoices: billingData?.overdueInvoices ?? 0,
    totalPayments: billingData?.totalPayments ?? 0,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useCustomer360ViewQuery(
    { customerId },
    {
      enabled: enabled && !!customerId,
    },
  );

  const subscriptions = data?.customerSubscriptions ?? [];
  const activeSubscriptions = subscriptions.filter(
    (sub: any) => sub.status === "ACTIVE" || sub.status === "TRIALING",
  );

  // Parse JSON scalars
  const networkInfo = (data?.customerNetworkInfo as any) ?? {};
  const devicesInfo = (data?.customerDevices as any) ?? {};
  const ticketsInfo = (data?.customerTickets as any) ?? {};
  const billingInfo = (data?.customerBilling as any) ?? {};

  return {
    customer: data?.customer ?? null,
    subscriptions: {
      current: activeSubscriptions[0] ?? null,
      total: subscriptions.length,
      active: activeSubscriptions.length,
    },
    network: networkInfo,
    devices: {
      total: devicesInfo?.totalDevices ?? 0,
      online: devicesInfo?.onlineDevices ?? 0,
      offline: devicesInfo?.offlineDevices ?? 0,
    },
    tickets: {
      open: ticketsInfo?.openCount ?? 0,
      closed: ticketsInfo?.closedCount ?? 0,
      critical: ticketsInfo?.criticalCount ?? 0,
    },
    billing: {
      summary: billingInfo?.summary ?? null,
      totalInvoices: billingInfo?.totalInvoices ?? 0,
      unpaidInvoices: billingInfo?.unpaidInvoices ?? 0,
    },
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

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
  useCustomerSubscriptionsGraphQL,
  useCustomerNetworkInfoGraphQL,
  useCustomerDevicesGraphQL,
  useCustomerTicketsGraphQL,
  useCustomerBillingGraphQL,
  useCustomer360ViewGraphQL,
};
