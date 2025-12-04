/**
 * NetBox IPAM & DCIM Hooks
 *
 * React hooks for NetBox API integration
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import type {
  IPAddress,
  CreateIPAddressRequest,
  UpdateIPAddressRequest,
  Prefix,
  CreatePrefixRequest,
  VRF,
  CreateVRFRequest,
  VLAN,
  CreateVLANRequest,
  UpdateVLANRequest,
  Site,
  CreateSiteRequest,
  Device,
  CreateDeviceRequest,
  UpdateDeviceRequest,
  Interface,
  CreateInterfaceRequest,
  Circuit,
  CreateCircuitRequest,
  UpdateCircuitRequest,
  CircuitProvider,
  CreateCircuitProviderRequest,
  CircuitType,
  CreateCircuitTypeRequest,
  NetBoxHealth,
  IPAllocationRequest,
  AvailableIP,
} from "@/types/netbox";

const API_BASE = "/netbox";

// ============================================================================
// Health
// ============================================================================

export function useNetBoxHealth() {
  return useQuery({
    queryKey: ["netbox", "health"],
    queryFn: async () => {
      const response = await apiClient.get<NetBoxHealth>(`${API_BASE}/health`);
      return response.data;
    },
    refetchInterval: 60000, // Check every minute
  });
}

// ============================================================================
// IPAM - IP Addresses
// ============================================================================

interface UseIPAddressesParams {
  tenant?: string;
  vrf?: string | number;
  vrf_id?: number; // Backward compatibility
  limit?: number;
  offset?: number;
}

export function useIPAddresses(params: UseIPAddressesParams = {}) {
  return useQuery({
    queryKey: ["netbox", "ip-addresses", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.tenant) searchParams.append("tenant", params.tenant);
      const vrf = params.vrf ?? params.vrf_id;
      if (vrf !== undefined) searchParams.append("vrf", vrf.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<IPAddress[]>(
        `${API_BASE}/ipam/ip-addresses?${searchParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function useIPAddress(ipId: number | undefined) {
  return useQuery({
    queryKey: ["netbox", "ip-addresses", ipId],
    queryFn: async () => {
      if (!ipId) throw new Error("IP Address ID is required");
      const response = await apiClient.get<IPAddress>(`${API_BASE}/ipam/ip-addresses/${ipId}`);
      return response.data;
    },
    enabled: !!ipId,
  });
}

export function useCreateIPAddress() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateIPAddressRequest) => {
      const response = await apiClient.post<IPAddress>(`${API_BASE}/ipam/ip-addresses`, data);
      return response.data;
    },
    onSuccess: (ip) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "ip-addresses"] });
      toast({
        title: "IP Address Created",
        description: `IP address ${ip.address} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create IP address",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateIPAddress() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateIPAddressRequest }) => {
      const response = await apiClient.patch<IPAddress>(
        `${API_BASE}/ipam/ip-addresses/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "ip-addresses"] });
      toast({
        title: "IP Address Updated",
        description: "IP address has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update IP address",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteIPAddress() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`${API_BASE}/ipam/ip-addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "ip-addresses"] });
      toast({
        title: "IP Address Deleted",
        description: "IP address has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete IP address",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// IPAM - Prefixes
// ============================================================================

interface UsePrefixesParams {
  tenant?: string;
  site?: string;
  vrf?: string | number;
  vrf_id?: number; // Backward compatibility
  limit?: number;
  offset?: number;
}

export function usePrefixes(params: UsePrefixesParams = {}) {
  return useQuery({
    queryKey: ["netbox", "prefixes", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.tenant) searchParams.append("tenant", params.tenant);
      if (params.site) searchParams.append("site", params.site);
      const vrf = params.vrf ?? params.vrf_id;
      if (vrf !== undefined) searchParams.append("vrf", vrf.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<Prefix[]>(
        `${API_BASE}/ipam/prefixes?${searchParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function usePrefix(prefixId: number | undefined) {
  return useQuery({
    queryKey: ["netbox", "prefixes", prefixId],
    queryFn: async () => {
      if (!prefixId) throw new Error("Prefix ID is required");
      const response = await apiClient.get<Prefix>(`${API_BASE}/ipam/prefixes/${prefixId}`);
      return response.data;
    },
    enabled: !!prefixId,
  });
}

export function useCreatePrefix() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePrefixRequest) => {
      const response = await apiClient.post<Prefix>(`${API_BASE}/ipam/prefixes`, data);
      return response.data;
    },
    onSuccess: (prefix) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "prefixes"] });
      toast({
        title: "Prefix Created",
        description: `Prefix ${prefix.prefix} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create prefix",
        variant: "destructive",
      });
    },
  });
}

export function useAvailableIPs(prefixId: number | undefined) {
  return useQuery({
    queryKey: ["netbox", "prefixes", prefixId, "available-ips"],
    queryFn: async () => {
      if (!prefixId) throw new Error("Prefix ID is required");
      const response = await apiClient.get<AvailableIP[]>(
        `${API_BASE}/ipam/prefixes/${prefixId}/available-ips`,
      );
      return response.data;
    },
    enabled: !!prefixId,
  });
}

export function useAllocateIP() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ prefixId, data }: { prefixId: number; data: IPAllocationRequest }) => {
      const response = await apiClient.post<IPAddress>(
        `${API_BASE}/ipam/prefixes/${prefixId}/allocate-ip`,
        data,
      );
      return response.data;
    },
    onSuccess: (ip) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "ip-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["netbox", "prefixes"] });
      toast({
        title: "IP Allocated",
        description: `IP address ${ip.address} has been allocated successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to allocate IP address",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// IPAM - VRFs
// ============================================================================

export function useVRFs() {
  return useQuery({
    queryKey: ["netbox", "vrfs"],
    queryFn: async () => {
      const response = await apiClient.get<VRF[]>(`${API_BASE}/ipam/vrfs`);
      return response.data;
    },
  });
}

export function useCreateVRF() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateVRFRequest) => {
      const response = await apiClient.post<VRF>(`${API_BASE}/ipam/vrfs`, data);
      return response.data;
    },
    onSuccess: (vrf) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "vrfs"] });
      toast({
        title: "VRF Created",
        description: `VRF ${vrf.name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create VRF",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// IPAM - VLANs
// ============================================================================

interface UseVLANsParams {
  site?: string;
  limit?: number;
  offset?: number;
}

export function useVLANs(params: UseVLANsParams = {}) {
  return useQuery({
    queryKey: ["netbox", "vlans", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.site) searchParams.append("site", params.site);
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<VLAN[]>(
        `${API_BASE}/ipam/vlans?${searchParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function useVLAN(vlanId: number | undefined) {
  return useQuery({
    queryKey: ["netbox", "vlans", vlanId],
    queryFn: async () => {
      if (!vlanId) throw new Error("VLAN ID is required");
      const response = await apiClient.get<VLAN>(`${API_BASE}/ipam/vlans/${vlanId}`);
      return response.data;
    },
    enabled: !!vlanId,
  });
}

export function useCreateVLAN() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateVLANRequest) => {
      const response = await apiClient.post<VLAN>(`${API_BASE}/ipam/vlans`, data);
      return response.data;
    },
    onSuccess: (vlan) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "vlans"] });
      toast({
        title: "VLAN Created",
        description: `VLAN ${vlan.vid} (${vlan.name}) has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create VLAN",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateVLAN() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateVLANRequest }) => {
      const response = await apiClient.patch<VLAN>(`${API_BASE}/ipam/vlans/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "vlans"] });
      toast({
        title: "VLAN Updated",
        description: "VLAN has been updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update VLAN",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// DCIM - Sites
// ============================================================================

interface UseSitesParams {
  limit?: number;
  offset?: number;
}

export function useSites(params: UseSitesParams = {}) {
  return useQuery({
    queryKey: ["netbox", "sites", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<Site[]>(
        `${API_BASE}/dcim/sites?${searchParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function useSite(siteId: number | undefined) {
  return useQuery({
    queryKey: ["netbox", "sites", siteId],
    queryFn: async () => {
      if (!siteId) throw new Error("Site ID is required");
      const response = await apiClient.get<Site>(`${API_BASE}/dcim/sites/${siteId}`);
      return response.data;
    },
    enabled: !!siteId,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateSiteRequest) => {
      const response = await apiClient.post<Site>(`${API_BASE}/dcim/sites`, data);
      return response.data;
    },
    onSuccess: (site) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "sites"] });
      toast({
        title: "Site Created",
        description: `Site ${site.name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create site",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// DCIM - Devices
// ============================================================================

interface UseDevicesParams {
  site?: string;
  limit?: number;
  offset?: number;
}

export function useDevices(params: UseDevicesParams = {}) {
  return useQuery({
    queryKey: ["netbox", "devices", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.site) searchParams.append("site", params.site);
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<Device[]>(
        `${API_BASE}/dcim/devices?${searchParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function useDevice(deviceId: number | undefined) {
  return useQuery({
    queryKey: ["netbox", "devices", deviceId],
    queryFn: async () => {
      if (!deviceId) throw new Error("Device ID is required");
      const response = await apiClient.get<Device>(`${API_BASE}/dcim/devices/${deviceId}`);
      return response.data;
    },
    enabled: !!deviceId,
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateDeviceRequest) => {
      const response = await apiClient.post<Device>(`${API_BASE}/dcim/devices`, data);
      return response.data;
    },
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "devices"] });
      toast({
        title: "Device Created",
        description: `Device ${device.name} has been created successfully`,
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
    mutationFn: async ({ id, data }: { id: number; data: UpdateDeviceRequest }) => {
      const response = await apiClient.patch<Device>(`${API_BASE}/dcim/devices/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "devices"] });
      toast({
        title: "Device Updated",
        description: "Device has been updated successfully",
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

// ============================================================================
// DCIM - Interfaces
// ============================================================================

interface UseInterfacesParams {
  device?: number;
  limit?: number;
  offset?: number;
}

export function useInterfaces(params: UseInterfacesParams = {}) {
  return useQuery({
    queryKey: ["netbox", "interfaces", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.device) searchParams.append("device_id", params.device.toString());
      if (params.limit) searchParams.append("limit", params.limit.toString());
      if (params.offset) searchParams.append("offset", params.offset.toString());

      const response = await apiClient.get<Interface[]>(
        `${API_BASE}/dcim/interfaces?${searchParams.toString()}`,
      );
      return response.data;
    },
  });
}

export function useCreateInterface() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateInterfaceRequest) => {
      const response = await apiClient.post<Interface>(`${API_BASE}/dcim/interfaces`, data);
      return response.data;
    },
    onSuccess: (iface) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "interfaces"] });
      toast({
        title: "Interface Created",
        description: `Interface ${iface.name} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create interface",
        variant: "destructive",
      });
    },
  });
}

// ============================================================================
// Circuits
// ============================================================================

export function useCircuits() {
  return useQuery({
    queryKey: ["netbox", "circuits"],
    queryFn: async () => {
      const response = await apiClient.get<Circuit[]>(`${API_BASE}/circuits`);
      return response.data;
    },
  });
}

export function useCreateCircuit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateCircuitRequest) => {
      const response = await apiClient.post<Circuit>(`${API_BASE}/circuits`, data);
      return response.data;
    },
    onSuccess: (circuit) => {
      queryClient.invalidateQueries({ queryKey: ["netbox", "circuits"] });
      toast({
        title: "Circuit Created",
        description: `Circuit ${circuit.cid} has been created successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create circuit",
        variant: "destructive",
      });
    },
  });
}

export function useCircuitProviders() {
  return useQuery({
    queryKey: ["netbox", "circuit-providers"],
    queryFn: async () => {
      const response = await apiClient.get<CircuitProvider[]>(`${API_BASE}/circuit-providers`);
      return response.data;
    },
  });
}

export function useCircuitTypes() {
  return useQuery({
    queryKey: ["netbox", "circuit-types"],
    queryFn: async () => {
      const response = await apiClient.get<CircuitType[]>(`${API_BASE}/circuit-types`);
      return response.data;
    },
  });
}
