/**
 * GraphQL Wrapper Hooks for Network Monitoring
 *
 * These hooks provide a convenient interface for network monitoring components,
 * wrapping the auto-generated GraphQL hooks with consistent error handling
 * and data transformation.
 *
 * Benefits:
 * - 80% fewer HTTP requests (5+ calls → 1-2 queries)
 * - Real-time device health and traffic data
 * - Batched alert loading
 * - Type-safe with auto-generated types
 */

import {
  useNetworkOverviewQuery,
  useNetworkDeviceListQuery,
  useDeviceDetailQuery,
  useDeviceTrafficQuery,
  useNetworkAlertListQuery,
  useNetworkAlertDetailQuery,
  useNetworkDashboardQuery,
  DeviceTypeEnum,
  DeviceStatusEnum,
  AlertSeverityEnum,
} from "@/lib/graphql/generated";

// ============================================================================
// Network Overview Hook
// ============================================================================

export interface UseNetworkOverviewOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useNetworkOverviewGraphQL(options: UseNetworkOverviewOptions = {}) {
  const { enabled = true, pollInterval = 30000 } = options; // 30 seconds default

  const { data, loading, error, refetch } = useNetworkOverviewQuery({
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const overview = data?.networkOverview;

  return {
    overview: {
      totalDevices: overview?.totalDevices ?? 0,
      onlineDevices: overview?.onlineDevices ?? 0,
      offlineDevices: overview?.offlineDevices ?? 0,
      activeAlerts: overview?.activeAlerts ?? 0,
      criticalAlerts: overview?.criticalAlerts ?? 0,
      totalBandwidthGbps: overview?.totalBandwidthGbps ?? 0,
      uptimePercentage: overview?.uptimePercentage ?? 0,
      deviceTypeSummary: overview?.deviceTypeSummary ?? [],
      recentAlerts: overview?.recentAlerts ?? [],
    },
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Network Devices List Hook
// ============================================================================

export interface UseNetworkDeviceListOptions {
  page?: number | undefined;
  pageSize?: number | undefined;
  deviceType?: DeviceTypeEnum | undefined;
  status?: DeviceStatusEnum | undefined;
  search?: string | undefined;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useNetworkDeviceListGraphQL(options: UseNetworkDeviceListOptions = {}) {
  const {
    page = 1,
    pageSize = 20,
    deviceType,
    status,
    search,
    enabled = true,
    pollInterval = 30000,
  } = options;

  const { data, loading, error, refetch } = useNetworkDeviceListQuery({
    variables: {
      page,
      pageSize,
      deviceType,
      status,
      search: search || undefined,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const devices = data?.networkDevices?.devices ?? [];
  const totalCount = data?.networkDevices?.totalCount ?? 0;
  const hasNextPage = data?.networkDevices?.hasNextPage ?? false;
  const hasPrevPage = data?.networkDevices?.hasPrevPage ?? false;

  return {
    devices,
    total: totalCount,
    hasNextPage,
    hasPrevPage,
    page: data?.networkDevices?.page ?? page,
    pageSize: data?.networkDevices?.pageSize ?? pageSize,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Device Detail Hook
// ============================================================================

export interface UseDeviceDetailOptions {
  deviceId: string;
  deviceType: DeviceTypeEnum;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useDeviceDetailGraphQL(options: UseDeviceDetailOptions) {
  const { deviceId, deviceType, enabled = true, pollInterval = 10000 } = options; // 10 seconds for details

  const { data, loading, error, refetch } = useDeviceDetailQuery({
    variables: {
      deviceId,
      deviceType,
    },
    skip: !enabled || !deviceId,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const deviceHealth = data?.deviceHealth ?? null;
  const deviceTraffic = data?.deviceTraffic ?? null;

  return {
    device: deviceHealth,
    traffic: deviceTraffic,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Device Traffic Hook
// ============================================================================

export interface UseDeviceTrafficOptions {
  deviceId: string;
  deviceType: DeviceTypeEnum;
  includeInterfaces?: boolean;
  enabled?: boolean;
  pollInterval?: number;
}

export function useDeviceTrafficGraphQL(options: UseDeviceTrafficOptions) {
  const {
    deviceId,
    deviceType,
    includeInterfaces = false,
    enabled = true,
    pollInterval = 5000, // 5 seconds for traffic data
  } = options;

  const { data, loading, error, refetch } = useDeviceTrafficQuery({
    variables: {
      deviceId,
      deviceType,
      includeInterfaces,
    },
    skip: !enabled || !deviceId,
    pollInterval,
    fetchPolicy: "network-only", // Always fetch fresh traffic data
  });

  const traffic = data?.deviceTraffic ?? null;

  return {
    traffic,
    interfaces: traffic?.interfaces ?? [],
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Network Alerts List Hook
// ============================================================================

export interface UseNetworkAlertListOptions {
  page?: number | undefined;
  pageSize?: number | undefined;
  severity?: AlertSeverityEnum | undefined;
  activeOnly?: boolean | undefined;
  deviceId?: string | undefined;
  deviceType?: DeviceTypeEnum | undefined;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useNetworkAlertListGraphQL(options: UseNetworkAlertListOptions = {}) {
  const {
    page = 1,
    pageSize = 50,
    severity,
    activeOnly = true,
    deviceId,
    deviceType,
    enabled = true,
    pollInterval = 15000, // 15 seconds for alerts
  } = options;

  const { data, loading, error, refetch } = useNetworkAlertListQuery({
    variables: {
      page,
      pageSize,
      severity,
      activeOnly,
      deviceId,
      deviceType,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const alerts = data?.networkAlerts?.alerts ?? [];
  const totalCount = data?.networkAlerts?.totalCount ?? 0;
  const hasNextPage = data?.networkAlerts?.hasNextPage ?? false;
  const hasPrevPage = data?.networkAlerts?.hasPrevPage ?? false;

  return {
    alerts,
    total: totalCount,
    hasNextPage,
    hasPrevPage,
    page: data?.networkAlerts?.page ?? page,
    pageSize: data?.networkAlerts?.pageSize ?? pageSize,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Network Alert Detail Hook
// ============================================================================

export interface UseNetworkAlertDetailOptions {
  alertId: string;
  enabled?: boolean | undefined;
}

export function useNetworkAlertDetailGraphQL(options: UseNetworkAlertDetailOptions) {
  const { alertId, enabled = true } = options;

  const { data, loading, error, refetch } = useNetworkAlertDetailQuery({
    variables: { alertId },
    skip: !enabled || !alertId,
    fetchPolicy: "cache-and-network",
  });

  const alert = data?.networkAlert ?? null;

  return {
    alert,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Network Dashboard Hook (Combined)
// ============================================================================

export interface UseNetworkDashboardOptions {
  devicePage?: number | undefined;
  devicePageSize?: number | undefined;
  deviceType?: DeviceTypeEnum | undefined;
  deviceStatus?: DeviceStatusEnum | undefined;
  alertPage?: number | undefined;
  alertPageSize?: number | undefined;
  alertSeverity?: AlertSeverityEnum | undefined;
  enabled?: boolean | undefined;
  pollInterval?: number | undefined;
}

export function useNetworkDashboardGraphQL(options: UseNetworkDashboardOptions = {}) {
  const {
    devicePage = 1,
    devicePageSize = 10,
    deviceType,
    deviceStatus,
    alertPage = 1,
    alertPageSize = 20,
    alertSeverity,
    enabled = true,
    pollInterval = 30000,
  } = options;

  const { data, loading, error, refetch } = useNetworkDashboardQuery({
    variables: {
      devicePage,
      devicePageSize,
      deviceType,
      deviceStatus,
      alertPage,
      alertPageSize,
      alertSeverity,
    },
    skip: !enabled,
    pollInterval,
    fetchPolicy: "cache-and-network",
  });

  const overview = data?.networkOverview;
  const devices = data?.networkDevices?.devices ?? [];
  const devicesTotal = data?.networkDevices?.totalCount ?? 0;
  const devicesHasNextPage = data?.networkDevices?.hasNextPage ?? false;
  const alerts = data?.networkAlerts?.alerts ?? [];
  const alertsTotal = data?.networkAlerts?.totalCount ?? 0;
  const alertsHasNextPage = data?.networkAlerts?.hasNextPage ?? false;

  return {
    overview: {
      totalDevices: overview?.totalDevices ?? 0,
      onlineDevices: overview?.onlineDevices ?? 0,
      offlineDevices: overview?.offlineDevices ?? 0,
      activeAlerts: overview?.activeAlerts ?? 0,
      criticalAlerts: overview?.criticalAlerts ?? 0,
      totalBandwidthGbps: overview?.totalBandwidthGbps ?? 0,
      uptimePercentage: overview?.uptimePercentage ?? 0,
      deviceTypeSummary: overview?.deviceTypeSummary ?? [],
      recentAlerts: overview?.recentAlerts ?? [],
    },
    devices,
    devicesTotal,
    devicesHasNextPage,
    alerts,
    alertsTotal,
    alertsHasNextPage,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}

// ============================================================================
// Export All Hooks
// ============================================================================

export const NetworkGraphQLHooks = {
  useNetworkOverviewGraphQL,
  useNetworkDeviceListGraphQL,
  useDeviceDetailGraphQL,
  useDeviceTrafficGraphQL,
  useNetworkAlertListGraphQL,
  useNetworkAlertDetailGraphQL,
  useNetworkDashboardGraphQL,
};
