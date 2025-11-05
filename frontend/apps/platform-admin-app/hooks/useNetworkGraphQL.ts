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
 *
 * Migration: Migrated from Apollo to TanStack Query via @dotmac/graphql
 */

import {
  useNetworkOverviewQuery,
  useNetworkDeviceListQuery,
  useDeviceDetailQuery,
  useDeviceTrafficQuery,
  useNetworkAlertListQuery,
  useNetworkAlertDetailQuery,
  useNetworkDashboardQuery,
} from "@dotmac/graphql/generated/react-query";

import {
  DeviceTypeEnum,
  DeviceStatusEnum,
  AlertSeverityEnum,
} from "@dotmac/graphql/generated";

// ============================================================================
// Network Overview Hook
// ============================================================================

export interface UseNetworkOverviewOptions {
  enabled?: boolean;
  pollInterval?: number;
}

export function useNetworkOverviewGraphQL(options: UseNetworkOverviewOptions = {}) {
  const { enabled = true, pollInterval = 30000 } = options; // 30 seconds default

  const { data, isLoading, error, refetch } = useNetworkOverviewQuery(
    undefined, // no variables
    {
      enabled,
      refetchInterval: pollInterval,
    },
  );

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
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Network Devices List Hook
// ============================================================================

export interface UseNetworkDeviceListOptions {
  page?: number;
  pageSize?: number;
  deviceType?: DeviceTypeEnum;
  status?: DeviceStatusEnum;
  search?: string;
  enabled?: boolean;
  pollInterval?: number;
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

  const { data, isLoading, error, refetch } = useNetworkDeviceListQuery(
    {
      page,
      pageSize,
      deviceType,
      status,
      search: search || undefined,
    },
    {
      enabled,
      refetchInterval: pollInterval,
    },
  );

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
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Device Detail Hook
// ============================================================================

export interface UseDeviceDetailOptions {
  deviceId: string;
  deviceType: DeviceTypeEnum;
  enabled?: boolean;
  pollInterval?: number;
}

export function useDeviceDetailGraphQL(options: UseDeviceDetailOptions) {
  const { deviceId, deviceType, enabled = true, pollInterval = 10000 } = options; // 10 seconds for details

  const { data, isLoading, error, refetch } = useDeviceDetailQuery(
    {
      deviceId,
      deviceType,
    },
    {
      enabled: enabled && !!deviceId,
      refetchInterval: pollInterval,
    },
  );

  const deviceHealth = data?.deviceHealth ?? null;
  const deviceTraffic = data?.deviceTraffic ?? null;

  return {
    device: deviceHealth,
    traffic: deviceTraffic,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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

  const { data, isLoading, error, refetch } = useDeviceTrafficQuery(
    {
      deviceId,
      deviceType,
      includeInterfaces,
    },
    {
      enabled: enabled && !!deviceId,
      refetchInterval: pollInterval,
      staleTime: 0, // Always fetch fresh traffic data (equivalent to network-only)
    },
  );

  const traffic = data?.deviceTraffic ?? null;

  return {
    traffic,
    interfaces: traffic?.interfaces ?? [],
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Network Alerts List Hook
// ============================================================================

export interface UseNetworkAlertListOptions {
  page?: number;
  pageSize?: number;
  severity?: AlertSeverityEnum;
  activeOnly?: boolean;
  deviceId?: string;
  deviceType?: DeviceTypeEnum;
  enabled?: boolean;
  pollInterval?: number;
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

  const { data, isLoading, error, refetch } = useNetworkAlertListQuery(
    {
      page,
      pageSize,
      severity,
      activeOnly,
      deviceId,
      deviceType,
    },
    {
      enabled,
      refetchInterval: pollInterval,
    },
  );

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
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Network Alert Detail Hook
// ============================================================================

export interface UseNetworkAlertDetailOptions {
  alertId: string;
  enabled?: boolean;
}

export function useNetworkAlertDetailGraphQL(options: UseNetworkAlertDetailOptions) {
  const { alertId, enabled = true } = options;

  const { data, isLoading, error, refetch } = useNetworkAlertDetailQuery(
    { alertId },
    {
      enabled: enabled && !!alertId,
    },
  );

  const alert = data?.networkAlert ?? null;

  return {
    alert,
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refetch,
  };
}

// ============================================================================
// Network Dashboard Hook (Combined)
// ============================================================================

export interface UseNetworkDashboardOptions {
  devicePage?: number;
  devicePageSize?: number;
  deviceType?: DeviceTypeEnum;
  deviceStatus?: DeviceStatusEnum;
  alertPage?: number;
  alertPageSize?: number;
  alertSeverity?: AlertSeverityEnum;
  enabled?: boolean;
  pollInterval?: number;
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

  const { data, isLoading, error, refetch } = useNetworkDashboardQuery(
    {
      devicePage,
      devicePageSize,
      deviceType,
      deviceStatus,
      alertPage,
      alertPageSize,
      alertSeverity,
    },
    {
      enabled,
      refetchInterval: pollInterval,
    },
  );

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
    isLoading,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
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
