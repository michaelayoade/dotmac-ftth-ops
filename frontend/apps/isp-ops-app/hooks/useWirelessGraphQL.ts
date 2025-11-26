/**
 * GraphQL Wrapper Hooks for Wireless Network Management
 *
 * These hooks provide a convenient interface for wireless management components,
 * wrapping the auto-generated GraphQL hooks with consistent error handling,
 * data transformation, and loading states.
 *
 * Benefits:
 * - Type-safe with auto-generated TypeScript types
 * - Consistent error handling across all wireless queries
 * - Optimized caching and refetching strategies
 * - Polling support for real-time updates
 * - Simplified API for common use cases
 */

import {
  useAccessPointListQuery,
  useAccessPointDetailQuery,
  useAccessPointsBySiteQuery,
  useWirelessClientListQuery,
  useWirelessClientDetailQuery,
  useWirelessClientsByAccessPointQuery,
  useWirelessClientsByCustomerQuery,
  useCoverageZoneListQuery,
  useCoverageZoneDetailQuery,
  useCoverageZonesBySiteQuery,
  useRfAnalyticsQuery,
  useChannelUtilizationQuery,
  useWirelessSiteMetricsQuery,
  useWirelessDashboardQuery,
  AccessPointStatus,
  FrequencyBand,
} from "@/lib/graphql/generated";

const hasDefinedData = (value: unknown) => typeof value !== "undefined";

const normalizeLoadingState = (
  loading: boolean,
  enabled: boolean,
  hasData: boolean,
  error?: Error,
) => {
  if (!enabled) {
    return false;
  }
  if (error) {
    return false;
  }
  if (hasData) {
    return false;
  }
  return loading;
};

// ============================================================================
// Access Point List Hook
// ============================================================================

export interface UseAccessPointListOptions {
  limit?: number | undefined;
  offset?: number | undefined;
  status?: AccessPointStatus | undefined;
  siteId?: string | undefined;
  search?: string | undefined;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useAccessPointListGraphQL(options: UseAccessPointListOptions = {}) {
  const {
    limit = 50,
    offset = 0,
    status,
    siteId,
    search,
    enabled = true,
    pollInterval = 30000, // 30 seconds for real-time updates
  } = options;

  const { data, loading, error, refetch } = useAccessPointListQuery({
    variables: {
      limit,
      offset,
      status,
      siteId,
      search: search || undefined,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const accessPoints = data?.accessPoints?.accessPoints ?? [];
  const totalCount = data?.accessPoints?.totalCount ?? 0;
  const hasNextPage = data?.accessPoints?.hasNextPage ?? false;
  const normalizedLoading = normalizeLoadingState(loading, enabled, hasDefinedData(data), error);

  return {
    accessPoints,
    total: totalCount,
    hasNextPage,
    limit,
    offset,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Access Point Detail Hook
// ============================================================================

export interface UseAccessPointDetailOptions {
  id: string;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useAccessPointDetailGraphQL(options: UseAccessPointDetailOptions) {
  const {
    id,
    enabled = true,
    pollInterval = 10000, // 10 seconds for detail view
  } = options;

  const { data, loading, error, refetch } = useAccessPointDetailQuery({
    variables: { id },
    skip: !enabled || !id,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const accessPoint = data?.accessPoint ?? null;
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(id),
    hasDefinedData(data),
    error,
  );

  return {
    accessPoint,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Access Points by Site Hook
// ============================================================================

export interface UseAccessPointsBySiteOptions {
  siteId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useAccessPointsBySiteGraphQL(options: UseAccessPointsBySiteOptions) {
  const { siteId, enabled = true, pollInterval = 30000 } = options;

  const { data, loading, error, refetch } = useAccessPointsBySiteQuery({
    variables: { siteId },
    skip: !enabled || !siteId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const accessPoints = data?.accessPointsBySite ?? [];
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(siteId),
    hasDefinedData(data),
    error,
  );

  return {
    accessPoints,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Wireless Client List Hook
// ============================================================================

export interface UseWirelessClientListOptions {
  limit?: number;
  offset?: number;
  accessPointId?: string;
  customerId?: string;
  frequencyBand?: FrequencyBand;
  search?: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useWirelessClientListGraphQL(options: UseWirelessClientListOptions = {}) {
  const {
    limit = 50,
    offset = 0,
    accessPointId,
    customerId,
    frequencyBand,
    search,
    enabled = true,
    pollInterval = 15000, // 15 seconds for client list
  } = options;

  const { data, loading, error, refetch } = useWirelessClientListQuery({
    variables: {
      limit,
      offset,
      accessPointId,
      customerId,
      frequencyBand,
      search: search || undefined,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const clients = data?.wirelessClients?.clients ?? [];
  const totalCount = data?.wirelessClients?.totalCount ?? 0;
  const hasNextPage = data?.wirelessClients?.hasNextPage ?? false;
  const normalizedLoading = normalizeLoadingState(loading, enabled, hasDefinedData(data), error);

  return {
    clients,
    total: totalCount,
    hasNextPage,
    limit,
    offset,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Wireless Client Detail Hook
// ============================================================================

export interface UseWirelessClientDetailOptions {
  id: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useWirelessClientDetailGraphQL(options: UseWirelessClientDetailOptions) {
  const { id, enabled = true, pollInterval = 10000 } = options;

  const { data, loading, error, refetch } = useWirelessClientDetailQuery({
    variables: { id },
    skip: !enabled || !id,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const client = data?.wirelessClient ?? null;
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(id),
    hasDefinedData(data),
    error,
  );

  return {
    client,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Wireless Clients by Access Point Hook
// ============================================================================

export interface UseWirelessClientsByAccessPointOptions {
  accessPointId: string;
  limit?: number;
  enabled?: boolean;
  pollInterval?: number;
}

export function useWirelessClientsByAccessPointGraphQL(
  options: UseWirelessClientsByAccessPointOptions,
) {
  const { accessPointId, enabled = true, pollInterval = 15000 } = options;

  const { data, loading, error, refetch } = useWirelessClientsByAccessPointQuery({
    variables: { accessPointId },
    skip: !enabled || !accessPointId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const clients = data?.wirelessClientsByAccessPoint ?? [];
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(accessPointId),
    hasDefinedData(data),
    error,
  );

  return {
    clients,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Wireless Clients by Customer Hook
// ============================================================================

export interface UseWirelessClientsByCustomerOptions {
  customerId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useWirelessClientsByCustomerGraphQL(options: UseWirelessClientsByCustomerOptions) {
  const { customerId, enabled = true, pollInterval = 30000 } = options;

  const { data, loading, error, refetch } = useWirelessClientsByCustomerQuery({
    variables: { customerId },
    skip: !enabled || !customerId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const clients = data?.wirelessClientsByCustomer ?? [];
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(customerId),
    hasDefinedData(data),
    error,
  );

  return {
    clients,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Coverage Zone List Hook
// ============================================================================

export interface UseCoverageZoneListOptions {
  limit?: number;
  offset?: number;
  siteId?: string;
  search?: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCoverageZoneListGraphQL(options: UseCoverageZoneListOptions = {}) {
  const {
    limit = 50,
    offset = 0,
    siteId,
    search,
    enabled = true,
    pollInterval = 60000, // 60 seconds - coverage zones change less frequently
  } = options;

  const { data, loading, error, refetch } = useCoverageZoneListQuery({
    variables: {
      limit,
      offset,
      siteId,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const zones = data?.coverageZones?.zones ?? [];
  const totalCount = data?.coverageZones?.totalCount ?? 0;
  const hasNextPage = data?.coverageZones?.hasNextPage ?? false;
  const normalizedLoading = normalizeLoadingState(loading, enabled, hasDefinedData(data), error);

  return {
    zones,
    total: totalCount,
    hasNextPage,
    limit,
    offset,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Coverage Zone Detail Hook
// ============================================================================

export interface UseCoverageZoneDetailOptions {
  id: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCoverageZoneDetailGraphQL(options: UseCoverageZoneDetailOptions) {
  const { id, enabled = true, pollInterval = 60000 } = options;

  const { data, loading, error, refetch } = useCoverageZoneDetailQuery({
    variables: { id },
    skip: !enabled || !id,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const zone = data?.coverageZone ?? null;
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(id),
    hasDefinedData(data),
    error,
  );

  return {
    zone,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Coverage Zones by Site Hook
// ============================================================================

export interface UseCoverageZonesBySiteOptions {
  siteId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useCoverageZonesBySiteGraphQL(options: UseCoverageZonesBySiteOptions) {
  const { siteId, enabled = true, pollInterval = 60000 } = options;

  const { data, loading, error, refetch } = useCoverageZonesBySiteQuery({
    variables: { siteId },
    skip: !enabled || !siteId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const zones = data?.coverageZonesBySite ?? [];
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(siteId),
    hasDefinedData(data),
    error,
  );

  return {
    zones,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// RF Analytics Hook
// ============================================================================

export interface UseRfAnalyticsOptions {
  siteId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useRfAnalyticsGraphQL(options: UseRfAnalyticsOptions) {
  const {
    siteId,
    enabled = true,
    pollInterval = 30000, // 30 seconds for RF analytics
  } = options;

  const { data, loading, error, refetch } = useRfAnalyticsQuery({
    variables: { siteId },
    skip: !enabled || !siteId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const analytics = data?.rfAnalytics ?? null;
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(siteId),
    hasDefinedData(data),
    error,
  );

  return {
    analytics,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Channel Utilization Hook
// ============================================================================

export interface UseChannelUtilizationOptions {
  siteId: string;
  band?: FrequencyBand;
  enabled?: boolean;
  pollInterval?: number;
}

export function useChannelUtilizationGraphQL(options: UseChannelUtilizationOptions) {
  const { siteId, band, enabled = true, pollInterval = 30000 } = options;

  const { data, loading, error, refetch } = useChannelUtilizationQuery({
    variables: { siteId, frequencyBand: band! },
    skip: !enabled || !siteId || !band,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const channelUtilization = data?.channelUtilization ?? [];
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(siteId) && Boolean(band),
    hasDefinedData(data),
    error,
  );

  return {
    channelUtilization,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Wireless Site Metrics Hook
// ============================================================================

export interface UseWirelessSiteMetricsOptions {
  siteId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useWirelessSiteMetricsGraphQL(options: UseWirelessSiteMetricsOptions) {
  const { siteId, enabled = true, pollInterval = 30000 } = options;

  const { data, loading, error, refetch } = useWirelessSiteMetricsQuery({
    variables: { siteId },
    skip: !enabled || !siteId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const metrics = data?.wirelessSiteMetrics ?? null;
  const normalizedLoading = normalizeLoadingState(
    loading,
    enabled && Boolean(siteId),
    hasDefinedData(data),
    error,
  );

  return {
    metrics,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Wireless Dashboard Hook
// ============================================================================

export interface UseWirelessDashboardOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useWirelessDashboardGraphQL(options: UseWirelessDashboardOptions = {}) {
  const {
    enabled = true,
    pollInterval = 30000, // 30 seconds for dashboard
  } = options;

  const { data, loading, error, refetch } = useWirelessDashboardQuery({
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const dashboard = data?.wirelessDashboard ?? null;
  const normalizedLoading = normalizeLoadingState(loading, enabled, hasDefinedData(data), error);

  return {
    dashboard,
    loading: normalizedLoading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate signal quality percentage from RSSI value
 * @param rssiDbm - RSSI value in dBm
 * @returns Signal quality percentage (0-100)
 */
export function calculateSignalQuality(rssiDbm: number | null | undefined): number {
  if (!rssiDbm) return 0;

  // RSSI to quality percentage conversion
  // -30 dBm = 100% (excellent)
  // -50 dBm = 75% (good)
  // -70 dBm = 50% (fair)
  // -90 dBm = 0% (poor)

  if (rssiDbm >= -30) return 100;
  if (rssiDbm <= -90) return 0;

  return Math.round(((rssiDbm + 90) / 60) * 100);
}

/**
 * Get signal quality label from RSSI value
 * @param rssiDbm - RSSI value in dBm
 * @returns Signal quality label
 */
export function getSignalQualityLabel(rssiDbm: number | null | undefined): string {
  if (!rssiDbm) return "Unknown";

  if (rssiDbm >= -50) return "Excellent";
  if (rssiDbm >= -60) return "Good";
  if (rssiDbm >= -70) return "Fair";
  return "Poor";
}

/**
 * Get frequency band label
 * @param band - Frequency band enum
 * @returns Human-readable frequency band label
 */
export function getFrequencyBandLabel(band: FrequencyBand | null | undefined): string {
  if (!band) return "Unknown";

  switch (band) {
    case FrequencyBand.Band_2_4Ghz:
      return "2.4 GHz";
    case FrequencyBand.Band_5Ghz:
      return "5 GHz";
    case FrequencyBand.Band_6Ghz:
      return "6 GHz";
    default:
      return "Unknown";
  }
}
