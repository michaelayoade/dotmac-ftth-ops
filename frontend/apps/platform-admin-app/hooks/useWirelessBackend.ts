/**
 * Wireless Infrastructure Backend Hooks
 *
 * React hooks for wireless infrastructure that match backend API exactly
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import type {
  WirelessDevice,
  WirelessRadio,
  CoverageZone,
  SignalMeasurement,
  WirelessClient,
  WirelessStatistics,
  DeviceHealthSummary,
  DeviceType,
  DeviceStatus,
  CreateDeviceRequest,
  UpdateDeviceRequest,
  CreateRadioRequest,
  UpdateRadioRequest,
  CreateCoverageZoneRequest,
  CreateSignalMeasurementRequest,
} from "@/types/wireless-backend";

const API_BASE = "/wireless";

// ============================================================================
// Wireless Devices
// ============================================================================

interface UseDevicesParams {
  device_type?: DeviceType;
  status?: DeviceStatus;
  site_name?: string;
  limit?: number;
  offset?: number;
}

export function useWirelessDevices(params: UseDevicesParams = {}) {
  const { toast } = useToast();

  return useQuery({
    queryKey: ["wireless", "devices", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device_type) searchParams.append("device_type", params.device_type);
      if (params.status) searchParams.append("status", params.status);
      if (params.site_name) searchParams.append("site_name", params.site_name);
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<WirelessDevice[]>(
        `${API_BASE}/devices?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useWirelessDevice(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["wireless", "devices", deviceId],
    queryFn: async () => {
      if (!deviceId) throw new Error("Device ID is required");
      const response = await apiClient.get<WirelessDevice>(`${API_BASE}/devices/${deviceId}`);
      return response.data;
    },
    enabled: !!deviceId,
    refetchInterval: 30000,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateDeviceRequest) => {
      const response = await apiClient.post<WirelessDevice>(`${API_BASE}/devices`, data);
      return response.data;
    },
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ["wireless", "devices"] });
      queryClient.invalidateQueries({ queryKey: ["wireless", "statistics"] });
      toast({
        title: "Device Created",
        description: `${device.name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create device",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateDeviceRequest }) => {
      const response = await apiClient.patch<WirelessDevice>(`${API_BASE}/devices/${id}`, data);
      return response.data;
    },
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ["wireless", "devices"] });
      queryClient.invalidateQueries({ queryKey: ["wireless", "statistics"] });
      toast({
        title: "Device Updated",
        description: `${device.name} has been updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update device",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${API_BASE}/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wireless", "devices"] });
      queryClient.invalidateQueries({ queryKey: ["wireless", "statistics"] });
      toast({
        title: "Device Deleted",
        description: "Device has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete device",
        variant: "destructive",
      });
    },
  });
}

export function useDeviceHealth(deviceId: string | undefined) {
  return useQuery({
    queryKey: ["wireless", "devices", deviceId, "health"],
    queryFn: async () => {
      if (!deviceId) throw new Error("Device ID is required");
      const response = await apiClient.get<DeviceHealthSummary>(
        `${API_BASE}/devices/${deviceId}/health`,
      );
      return response.data;
    },
    enabled: !!deviceId,
    refetchInterval: 30000,
  });
}

// ============================================================================
// Wireless Radios
// ============================================================================

interface UseRadiosParams {
  device_id?: string;
  limit?: number;
  offset?: number;
}

export function useWirelessRadios(params: UseRadiosParams = {}) {
  return useQuery({
    queryKey: ["wireless", "radios", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device_id) searchParams.append("device_id", params.device_id);
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<WirelessRadio[]>(
        `${API_BASE}/radios?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 15000, // Refetch every 15 seconds for radio metrics
  });
}

export function useWirelessRadio(radioId: string | undefined) {
  return useQuery({
    queryKey: ["wireless", "radios", radioId],
    queryFn: async () => {
      if (!radioId) throw new Error("Radio ID is required");
      const response = await apiClient.get<WirelessRadio>(`${API_BASE}/radios/${radioId}`);
      return response.data;
    },
    enabled: !!radioId,
    refetchInterval: 15000,
  });
}

export function useCreateRadio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRadioRequest) => {
      const response = await apiClient.post<WirelessRadio>(`${API_BASE}/radios`, data);
      return response.data;
    },
    onSuccess: (radio) => {
      queryClient.invalidateQueries({ queryKey: ["wireless", "radios"] });
      queryClient.invalidateQueries({
        queryKey: ["wireless", "devices", radio.device_id],
      });
      toast({
        title: "Radio Created",
        description: `${radio.radio_name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create radio",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateRadio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRadioRequest }) => {
      const response = await apiClient.patch<WirelessRadio>(`${API_BASE}/radios/${id}`, data);
      return response.data;
    },
    onSuccess: (radio) => {
      queryClient.invalidateQueries({ queryKey: ["wireless", "radios"] });
      queryClient.invalidateQueries({
        queryKey: ["wireless", "devices", radio.device_id],
      });
      toast({
        title: "Radio Updated",
        description: `${radio.radio_name} has been updated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update radio",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteRadio() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${API_BASE}/radios/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wireless", "radios"] });
      toast({
        title: "Radio Deleted",
        description: "Radio has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete radio",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Coverage Zones
// ============================================================================

interface UseCoverageZonesParams {
  device_id?: string;
  limit?: number;
  offset?: number;
}

export function useCoverageZones(params: UseCoverageZonesParams = {}) {
  return useQuery({
    queryKey: ["wireless", "coverage-zones", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device_id) searchParams.append("device_id", params.device_id);
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<CoverageZone[]>(
        `${API_BASE}/coverage-zones?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useCreateCoverageZone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateCoverageZoneRequest) => {
      const response = await apiClient.post<CoverageZone>(`${API_BASE}/coverage-zones`, data);
      return response.data;
    },
    onSuccess: (zone) => {
      queryClient.invalidateQueries({
        queryKey: ["wireless", "coverage-zones"],
      });
      toast({
        title: "Coverage Zone Created",
        description: `${zone.zone_name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create coverage zone",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCoverageZone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${API_BASE}/coverage-zones/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wireless", "coverage-zones"],
      });
      toast({
        title: "Coverage Zone Deleted",
        description: "Coverage zone has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete coverage zone",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Signal Measurements
// ============================================================================

interface UseSignalMeasurementsParams {
  device_id?: string;
  limit?: number;
  offset?: number;
}

export function useSignalMeasurements(params: UseSignalMeasurementsParams = {}) {
  return useQuery({
    queryKey: ["wireless", "signal-measurements", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device_id) searchParams.append("device_id", params.device_id);
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<SignalMeasurement[]>(
        `${API_BASE}/signal-measurements?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 30000,
  });
}

export function useCreateSignalMeasurement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSignalMeasurementRequest) => {
      const response = await apiClient.post<SignalMeasurement>(
        `${API_BASE}/signal-measurements`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wireless", "signal-measurements"],
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create signal measurement",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Wireless Clients
// ============================================================================

interface UseClientsParams {
  device_id?: string;
  connected?: boolean;
  limit?: number;
  offset?: number;
}

export function useWirelessClients(params: UseClientsParams = {}) {
  return useQuery({
    queryKey: ["wireless", "clients", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device_id) searchParams.append("device_id", params.device_id);
      if (params.connected !== undefined)
        searchParams.append("connected", params.connected.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<WirelessClient[]>(
        `${API_BASE}/clients?${searchParams.toString()}`,
      );
      return response.data;
    },
    refetchInterval: 10000, // Refetch every 10 seconds for client data
  });
}

// ============================================================================
// Statistics
// ============================================================================

export function useWirelessStatistics() {
  return useQuery({
    queryKey: ["wireless", "statistics"],
    queryFn: async () => {
      const response = await apiClient.get<WirelessStatistics>(`${API_BASE}/statistics`);
      return response.data;
    },
    refetchInterval: 30000,
  });
}
