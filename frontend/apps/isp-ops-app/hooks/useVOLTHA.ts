/**
 * VOLTHA PON Management Hooks
 *
 * Custom React Query hooks for VOLTHA data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import {
  VOLTHAHealthResponse,
  LogicalDeviceListResponse,
  LogicalDevice,
  DeviceListResponse,
  Device,
  VOLTHAAlarmListResponse,
  VOLTHAAlarm,
  OLTOverview,
  PONStatistics,
  DiscoveredONU,
  ONUProvisionRequest,
  ONUProvisionResponse,
  DeviceOperationResponse,
} from "@/types/voltha";

// ============================================================================
// Query Key Factory
// ============================================================================

export const volthaKeys = {
  all: ["voltha"] as const,
  health: () => [...volthaKeys.all, "health"] as const,
  olts: () => [...volthaKeys.all, "olts"] as const,
  olt: (oltId: string) => [...volthaKeys.all, "olt", oltId] as const,
  oltOverview: (oltId: string) => [...volthaKeys.all, "olt", oltId, "overview"] as const,
  onus: () => [...volthaKeys.all, "onus"] as const,
  onu: (onuId: string) => [...volthaKeys.all, "onu", onuId] as const,
  alarms: (deviceId?: string) =>
    deviceId
      ? ([...volthaKeys.all, "alarms", "device", deviceId] as const)
      : ([...volthaKeys.all, "alarms"] as const),
  portStatistics: (oltId: string, portNo: number) =>
    [...volthaKeys.all, "port-statistics", oltId, portNo] as const,
  discoveredONUs: () => [...volthaKeys.all, "discovered-onus"] as const,
} as const;

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Fetch VOLTHA system health status
 */
export function useVOLTHAHealth(options?: UseQueryOptions<VOLTHAHealthResponse>) {
  return useQuery({
    queryKey: volthaKeys.health(),
    queryFn: async () => {
      logger.info("Fetching VOLTHA health status");
      const response = await apiClient.get<VOLTHAHealthResponse>("/access/health");
      return response.data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    ...options,
  });
}

/**
 * Fetch all OLTs (Optical Line Terminals)
 */
export function useOLTs(options?: UseQueryOptions<LogicalDevice[]>) {
  return useQuery({
    queryKey: volthaKeys.olts(),
    queryFn: async () => {
      logger.info("Fetching OLTs");
      const response = await apiClient.get<LogicalDeviceListResponse>("/access/logical-devices");
      // Handle both response formats for backward compatibility
      return response.data.devices || response.data.logical_devices || [];
    },
    staleTime: 30000, // 30 seconds
    ...options,
  });
}

/**
 * Fetch OLT overview with PON port details
 */
export function useOLTOverview(
  oltId: string | null,
  options?: UseQueryOptions<OLTOverview | null>,
) {
  return useQuery({
    queryKey: volthaKeys.oltOverview(oltId ?? ""),
    queryFn: async () => {
      if (!oltId) return null;
      logger.info("Fetching OLT overview", { oltId });
      const response = await apiClient.get<OLTOverview>(`/access/olts/${oltId}/overview`);
      return response.data;
    },
    enabled: !!oltId,
    staleTime: 15000, // 15 seconds
    ...options,
  });
}

/**
 * Fetch all ONUs (Optical Network Units)
 */
export function useONUs(options?: UseQueryOptions<Device[]>) {
  return useQuery({
    queryKey: volthaKeys.onus(),
    queryFn: async () => {
      logger.info("Fetching ONUs");
      const response = await apiClient.get<DeviceListResponse>("/access/devices");
      // Filter out root devices (OLTs)
      return response.data.devices.filter((device) => !device.root);
    },
    staleTime: 15000, // 15 seconds
    ...options,
  });
}

/**
 * Fetch single ONU details
 */
export function useONU(onuId: string | null, options?: UseQueryOptions<Device | null>) {
  return useQuery({
    queryKey: volthaKeys.onu(onuId ?? ""),
    queryFn: async () => {
      if (!onuId) return null;
      logger.info("Fetching ONU details", { onuId });
      const response = await apiClient.get<Device>(`/access/devices/${onuId}`);
      return response.data;
    },
    enabled: !!onuId,
    staleTime: 10000, // 10 seconds
    ...options,
  });
}

/**
 * Fetch VOLTHA alarms (system-wide or device-specific)
 */
export function useVOLTHAAlarms(deviceId?: string, options?: UseQueryOptions<VOLTHAAlarm[]>) {
  return useQuery({
    queryKey: volthaKeys.alarms(deviceId),
    queryFn: async () => {
      const endpoint = deviceId ? `/access/devices/${deviceId}/alarms` : "/access/alarms";
      logger.info("Fetching VOLTHA alarms", { deviceId, endpoint });
      const response = await apiClient.get<VOLTHAAlarmListResponse>(endpoint);
      return response.data.alarms;
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Refetch every 30 seconds for alarms
    ...options,
  });
}

/**
 * Fetch PON port statistics
 */
export function usePONPortStatistics(
  oltId: string | null,
  portNo: number | null,
  options?: UseQueryOptions<PONStatistics | null>,
) {
  return useQuery({
    queryKey: volthaKeys.portStatistics(oltId ?? "", portNo ?? 0),
    queryFn: async () => {
      if (!oltId || portNo === null) return null;
      logger.info("Fetching PON port statistics", { oltId, portNo });
      const response = await apiClient.get<PONStatistics>(
        `/api/v1/access/devices/${oltId}/ports/${portNo}/statistics`,
      );
      return response.data;
    },
    enabled: !!oltId && portNo !== null,
    staleTime: 5000, // 5 seconds for real-time metrics
    ...options,
  });
}

/**
 * Discover unprovisioned ONUs
 */
export function useDiscoveredONUs(options?: UseQueryOptions<DiscoveredONU[]>) {
  return useQuery({
    queryKey: volthaKeys.discoveredONUs(),
    queryFn: async () => {
      logger.info("Discovering ONUs");
      const response = await apiClient.get<DiscoveredONU[]>("/access/discover-onus");
      return (response.data || []).map((onu) => ({
        ...onu,
        metadata: onu.metadata ?? {},
      }));
    },
    staleTime: 0, // Always fetch fresh when explicitly requested
    enabled: false, // Only fetch when manually triggered
    ...options,
  });
}

/**
 * Fetch all VOLTHA data at once (for dashboard)
 */
export function useVOLTHADashboard() {
  const health = useVOLTHAHealth();
  const olts = useOLTs();
  const onus = useONUs();
  const alarms = useVOLTHAAlarms();

  return {
    health: health.data,
    olts: olts.data ?? [],
    onus: onus.data ?? [],
    alarms: alarms.data ?? [],
    isLoading: health.isLoading || olts.isLoading || onus.isLoading || alarms.isLoading,
    isError: health.isError || olts.isError || onus.isError || alarms.isError,
    error: health.error || olts.error || onus.error || alarms.error,
    refetch: () => {
      health.refetch();
      olts.refetch();
      onus.refetch();
      alarms.refetch();
    },
  };
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Provision a new ONU
 */
export function useProvisionONU(options?: {
  onSuccess?: (data: ONUProvisionResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: ONUProvisionRequest) => {
      logger.info("Provisioning ONU", { request });
      const response = await apiClient.post<ONUProvisionResponse>(
        `/access/olts/${encodeURIComponent(request.olt_device_id)}/onus`,
        request,
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: volthaKeys.onus() });
      queryClient.invalidateQueries({ queryKey: volthaKeys.discoveredONUs() });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      logger.error("Failed to provision ONU", { error });
      options?.onError?.(error);
    },
  });
}

/**
 * Perform device operation (enable, disable, reboot, delete)
 */
export function useDeviceOperation(options?: {
  onSuccess?: (data: DeviceOperationResponse) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      operation,
      oltId,
    }: {
      deviceId: string;
      operation: "enable" | "disable" | "reboot" | "delete";
      oltId?: string;
    }) => {
      logger.info("Performing device operation", { deviceId, operation, oltId });
      const url = oltId
        ? `/access/devices/${deviceId}/${operation}?olt_id=${encodeURIComponent(oltId)}`
        : `/access/devices/${deviceId}/${operation}`;
      const response = await apiClient.post<DeviceOperationResponse>(url);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: volthaKeys.onus() });
      queryClient.invalidateQueries({ queryKey: volthaKeys.onu(data.device_id) });
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      logger.error("Failed to perform device operation", { error });
      options?.onError?.(error);
    },
  });
}

/**
 * Acknowledge an alarm
 */
export function useAcknowledgeAlarm(options?: {
  onSuccess?: (alarmId: string) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alarmId: string) => {
      logger.info("Acknowledging alarm", { alarmId });
      try {
        await apiClient.post(`/access/alarms/${alarmId}/acknowledge`);
      } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        if (status === 501 && detail) {
          throw new Error(detail);
        }
        if (status === 501) {
          throw new Error("Alarm acknowledgement not supported by this driver");
        }
        throw err;
      }
      return alarmId;
    },
    onSuccess: (alarmId) => {
      queryClient.invalidateQueries({ queryKey: volthaKeys.alarms() });
      options?.onSuccess?.(alarmId);
    },
    onError: (error: Error) => {
      logger.error("Failed to acknowledge alarm", { error });
      options?.onError?.(error);
    },
  });
}

/**
 * Clear an alarm
 */
export function useClearAlarm(options?: {
  onSuccess?: (alarmId: string) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alarmId: string) => {
      logger.info("Clearing alarm", { alarmId });
      try {
        await apiClient.post(`/access/alarms/${alarmId}/clear`);
      } catch (err: any) {
        const status = err?.response?.status;
        const detail = err?.response?.data?.detail;
        if (status === 501 && detail) {
          throw new Error(detail);
        }
        if (status === 501) {
          throw new Error("Alarm clearing not supported by this driver");
        }
        throw err;
      }
      return alarmId;
    },
    onSuccess: (alarmId) => {
      queryClient.invalidateQueries({ queryKey: volthaKeys.alarms() });
      options?.onSuccess?.(alarmId);
    },
    onError: (error: Error) => {
      logger.error("Failed to clear alarm", { error });
      options?.onError?.(error);
    },
  });
}
