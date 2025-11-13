/**
 * Network Monitoring Hooks
 *
 * React hooks for network device monitoring API integration
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import type {
  NetworkOverview,
  DeviceHealth,
  DeviceMetrics,
  TrafficStats,
  NetworkAlert,
  AlertRule,
  DeviceType,
  DeviceStatus,
  AlertSeverity,
  AcknowledgeAlertRequest,
  CreateAlertRuleRequest,
} from "@/types/network-monitoring";

const API_BASE = "";

// ============================================================================
// Network Overview
// ============================================================================

export function useNetworkOverview() {
  return useQuery({
    queryKey: ["network", "overview"],
    queryFn: async () => {
      const response = await apiClient.get<NetworkOverview>(`${API_BASE}/network/overview`);
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

// ============================================================================
// Device Health
// ============================================================================

interface UseDevicesParams {
  device_type?: DeviceType;
  status?: DeviceStatus;
}

export function useNetworkDevices(params: UseDevicesParams = {}) {
  return useQuery({
    queryKey: ["network", "devices", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device_type) searchParams.append("device_type", params.device_type);
      if (params.status) searchParams.append("status", params.status);

      const response = await apiClient.get<DeviceHealth[]>(
        `${API_BASE}/network/devices?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
}

export function useDeviceHealth(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["network", "devices", deviceId, "health"],
    queryFn: async () => {
      if (!deviceId) throw new Error("Device ID is required");
      const response = await apiClient.get<DeviceHealth>(
        `${API_BASE}/network/devices/${deviceId}/health`,
      );
      return response.data;
    },
    enabled: !!deviceId,
    refetchInterval: 15000,
  });
}

// ============================================================================
// Device Metrics
// ============================================================================

export function useDeviceMetrics(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["network", "devices", deviceId, "metrics"],
    queryFn: async () => {
      if (!deviceId) throw new Error("Device ID is required");
      const response = await apiClient.get<DeviceMetrics>(
        `${API_BASE}/network/devices/${deviceId}/metrics`,
      );
      return response.data;
    },
    enabled: !!deviceId,
    refetchInterval: 30000,
  });
}

// ============================================================================
// Traffic Stats
// ============================================================================

export function useDeviceTraffic(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["network", "devices", deviceId, "traffic"],
    queryFn: async () => {
      if (!deviceId) throw new Error("Device ID is required");
      const response = await apiClient.get<TrafficStats>(
        `${API_BASE}/network/devices/${deviceId}/traffic`,
      );
      return response.data;
    },
    enabled: !!deviceId,
    refetchInterval: 10000, // Refetch every 10 seconds for traffic data
  });
}

// ============================================================================
// Alerts
// ============================================================================

interface UseAlertsParams {
  severity?: AlertSeverity | undefined;
  active_only?: boolean | undefined;
  device_id?: string | undefined;
  limit?: number | undefined;
}

export function useNetworkAlerts(params: UseAlertsParams = {}) {
  return useQuery({
    queryKey: ["network", "alerts", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.severity) searchParams.append("severity", params.severity);
      if (params.active_only !== undefined) {
        searchParams.append("active_only", params.active_only.toString());
      }
      if (params.device_id) searchParams.append("device_id", params.device_id);
      if (params.limit) searchParams.append("limit", params.limit.toString());

      const response = await apiClient.get<NetworkAlert[]>(
        `${API_BASE}/network/alerts?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 15000, // Refetch every 15 seconds
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ alertId, data }: { alertId: string; data: AcknowledgeAlertRequest }) => {
      const response = await apiClient.post<NetworkAlert>(
        `${API_BASE}/network/alerts/${alertId}/acknowledge`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network", "alerts"] });
      queryClient.invalidateQueries({ queryKey: ["network", "overview"] });
      toast({
        title: "Alert Acknowledged",
        description: "The alert has been acknowledged successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to acknowledge alert",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Alert Rules
// ============================================================================

export function useAlertRules() {
  return useQuery({
    queryKey: ["network", "alert-rules"],
    queryFn: async () => {
      const response = await apiClient.get<AlertRule[]>(`${API_BASE}/network/alert-rules`);
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useCreateAlertRule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateAlertRuleRequest) => {
      const response = await apiClient.post<AlertRule>(`${API_BASE}/network/alert-rules`, data);
      return response.data;
    },
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: ["network", "alert-rules"] });
      toast({
        title: "Alert Rule Created",
        description: `Alert rule "${rule.name}" has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create alert rule",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Aggregated Hooks (for dashboard convenience)
// ============================================================================

/**
 * Hook that fetches all data needed for the network monitoring dashboard
 */
export function useNetworkDashboardData() {
  const overview = useNetworkOverview();
  const devices = useNetworkDevices({});
  const alerts = useNetworkAlerts({ active_only: true, limit: 10 });

  return {
    overview: overview.data,
    devices: devices.data || [],
    alerts: alerts.data || [],
    isLoading: overview.isLoading || devices.isLoading || alerts.isLoading,
    error: overview.error || devices.error || alerts.error,
    refetch: () => {
      overview.refetch();
      devices.refetch();
      alerts.refetch();
    },
  };
}

/**
 * Hook for device details page (combines health, metrics, and traffic)
 */
export function useDeviceDetails(deviceId: string | undefined) {
  const health = useDeviceHealth(deviceId);
  const metrics = useDeviceMetrics(deviceId);
  const traffic = useDeviceTraffic(deviceId);
  const alerts = useNetworkAlerts({ device_id: deviceId, active_only: true });

  return {
    health: health.data,
    metrics: metrics.data,
    traffic: traffic.data,
    alerts: alerts.data || [],
    isLoading: health.isLoading || metrics.isLoading || traffic.isLoading,
    error: health.error || metrics.error || traffic.error,
    refetch: () => {
      health.refetch();
      metrics.refetch();
      traffic.refetch();
      alerts.refetch();
    },
  };
}
