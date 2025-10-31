/**
 * React Query hooks for WireGuard VPN Management API
 *
 * Provides hooks for all 24 API endpoints with proper type safety.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type {
  ListPeersParams,
  ListServersParams,
  WireGuardBulkPeerCreateRequest,
  WireGuardBulkPeerCreateResponse,
  WireGuardDashboardStatsResponse,
  WireGuardPeer,
  WireGuardPeerConfigResponse,
  WireGuardPeerCreate,
  WireGuardPeerQRCodeResponse,
  WireGuardPeerUpdate,
  WireGuardServer,
  WireGuardServerCreate,
  WireGuardServerHealthResponse,
  WireGuardServerUpdate,
  WireGuardServiceProvisionRequest,
  WireGuardServiceProvisionResponse,
  WireGuardSyncStatsRequest,
  WireGuardSyncStatsResponse,
} from "../types/wireguard";

const API_BASE = "/wireguard";

// ============================================================================
// Query Keys
// ============================================================================

const baseKey = ["wireguard"] as const;

export const wireGuardKeys = {
  all: baseKey,
  servers: {
    all: [...baseKey, "servers"] as const,
    lists: () => [...baseKey, "servers", "list"] as const,
    list: (params: ListServersParams) => [...baseKey, "servers", "list", params] as const,
    detail: (id: string) => [...baseKey, "servers", "detail", id] as const,
    health: (id: string) => [...baseKey, "servers", "health", id] as const,
  },
  peers: {
    all: [...baseKey, "peers"] as const,
    lists: () => [...baseKey, "peers", "list"] as const,
    list: (params: ListPeersParams) => [...baseKey, "peers", "list", params] as const,
    detail: (id: string) => [...baseKey, "peers", "detail", id] as const,
    config: (id: string) => [...baseKey, "peers", "config", id] as const,
  },
  dashboard: () => [...baseKey, "dashboard"] as const,
};

// ============================================================================
// Server Management Hooks
// ============================================================================

/**
 * List WireGuard servers with optional filters
 */
export function useWireGuardServers(params: ListServersParams = {}) {
  return useQuery({
    queryKey: wireGuardKeys.servers.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.append("status", params.status);
      if (params.location) searchParams.append("location", params.location);
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.offset) searchParams.append("offset", String(params.offset));

      const url = `${API_BASE}/servers?${searchParams.toString()}`;
      const response = await apiClient.get<WireGuardServer[]>(url);
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get a single WireGuard server by ID
 */
export function useWireGuardServer(serverId: string | undefined) {
  return useQuery({
    queryKey: wireGuardKeys.servers.detail(serverId!),
    queryFn: async () => {
      const response = await apiClient.get<WireGuardServer>(`${API_BASE}/servers/${serverId}`);
      return response.data;
    },
    enabled: !!serverId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get server health status
 */
export function useServerHealth(serverId: string | undefined) {
  return useQuery({
    queryKey: wireGuardKeys.servers.health(serverId!),
    queryFn: async () => {
      const response = await apiClient.get<WireGuardServerHealthResponse>(
        `${API_BASE}/servers/${serverId}/health`,
      );
      return response.data;
    },
    enabled: !!serverId,
    staleTime: 10000, // 10 seconds (health checks should be frequent)
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

/**
 * Create a new WireGuard server
 */
export function useCreateWireGuardServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WireGuardServerCreate) => {
      const response = await apiClient.post<WireGuardServer>(`${API_BASE}/servers`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.lists(),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

/**
 * Update a WireGuard server
 */
export function useUpdateWireGuardServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ serverId, data }: { serverId: string; data: WireGuardServerUpdate }) => {
      const response = await apiClient.patch<WireGuardServer>(
        `${API_BASE}/servers/${serverId}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.detail(variables.serverId),
      });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.lists(),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

/**
 * Delete a WireGuard server (soft delete)
 */
export function useDeleteWireGuardServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (serverId: string) => {
      await apiClient.delete(`${API_BASE}/servers/${serverId}`);
      return serverId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.lists(),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

// ============================================================================
// Peer Management Hooks
// ============================================================================

/**
 * List WireGuard peers with optional filters
 */
export function useWireGuardPeers(params: ListPeersParams = {}) {
  return useQuery({
    queryKey: wireGuardKeys.peers.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.server_id) searchParams.append("server_id", params.server_id);
      if (params.customer_id) searchParams.append("customer_id", params.customer_id);
      if (params.subscriber_id) searchParams.append("subscriber_id", params.subscriber_id);
      if (params.status) searchParams.append("status", params.status);
      if (params.limit) searchParams.append("limit", String(params.limit));
      if (params.offset) searchParams.append("offset", String(params.offset));

      const url = `${API_BASE}/peers?${searchParams.toString()}`;
      const response = await apiClient.get<WireGuardPeer[]>(url);
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get a single WireGuard peer by ID
 */
export function useWireGuardPeer(peerId: string | undefined) {
  return useQuery({
    queryKey: wireGuardKeys.peers.detail(peerId!),
    queryFn: async () => {
      const response = await apiClient.get<WireGuardPeer>(`${API_BASE}/peers/${peerId}`);
      return response.data;
    },
    enabled: !!peerId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get peer configuration file
 */
export function usePeerConfig(peerId: string | undefined, enabled: boolean = false) {
  return useQuery({
    queryKey: wireGuardKeys.peers.config(peerId!),
    queryFn: async () => {
      const response = await apiClient.get<WireGuardPeerConfigResponse>(
        `${API_BASE}/peers/${peerId}/config`,
      );
      return response.data;
    },
    enabled: !!peerId && enabled,
    staleTime: Infinity, // Config doesn't change unless regenerated
  });
}

/**
 * Create a new WireGuard peer
 */
export function useCreateWireGuardPeer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WireGuardPeerCreate) => {
      const response = await apiClient.post<WireGuardPeer>(`${API_BASE}/peers`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.peers.lists() });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.detail(data.server_id),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

/**
 * Update a WireGuard peer
 */
export function useUpdateWireGuardPeer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ peerId, data }: { peerId: string; data: WireGuardPeerUpdate }) => {
      const response = await apiClient.patch<WireGuardPeer>(`${API_BASE}/peers/${peerId}`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.peers.detail(variables.peerId),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.peers.lists() });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.detail(data.server_id),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

/**
 * Delete a WireGuard peer (soft delete)
 */
export function useDeleteWireGuardPeer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (peerId: string) => {
      await apiClient.delete(`${API_BASE}/peers/${peerId}`);
      return peerId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.peers.lists() });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.lists(),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

/**
 * Regenerate peer configuration (new keypair)
 */
export function useRegeneratePeerConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (peerId: string) => {
      const response = await apiClient.post<WireGuardPeer>(
        `${API_BASE}/peers/${peerId}/regenerate`,
      );
      return response.data;
    },
    onSuccess: (data, peerId) => {
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.peers.detail(peerId),
      });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.peers.config(peerId),
      });
    },
  });
}

// ============================================================================
// Bulk Operations Hooks
// ============================================================================

/**
 * Create multiple peers in bulk
 */
export function useCreateBulkPeers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WireGuardBulkPeerCreateRequest) => {
      const response = await apiClient.post<WireGuardBulkPeerCreateResponse>(
        `${API_BASE}/peers/bulk`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.peers.lists() });
      const serverId = data.peers[0]?.server_id;
      if (serverId) {
        queryClient.invalidateQueries({
          queryKey: wireGuardKeys.servers.detail(serverId),
        });
      }
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

// ============================================================================
// Statistics & Monitoring Hooks
// ============================================================================

/**
 * Sync peer statistics from WireGuard container
 */
export function useSyncPeerStats() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WireGuardSyncStatsRequest) => {
      const response = await apiClient.post<WireGuardSyncStatsResponse>(
        `${API_BASE}/stats/sync`,
        data,
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate all peer lists for this server
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.peers.lists() });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.detail(data.server_id),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

/**
 * Get dashboard statistics
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: wireGuardKeys.dashboard(),
    queryFn: async () => {
      const response = await apiClient.get<WireGuardDashboardStatsResponse>(
        `${API_BASE}/dashboard`,
      );
      return response.data;
    },
    staleTime: 10000, // 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });
}

// ============================================================================
// Service Provisioning Hooks
// ============================================================================

/**
 * Provision VPN service for a customer (one-click setup)
 */
export function useProvisionVPNService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: WireGuardServiceProvisionRequest) => {
      const response = await apiClient.post<WireGuardServiceProvisionResponse>(
        `${API_BASE}/provision`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.peers.lists() });
      queryClient.invalidateQueries({
        queryKey: wireGuardKeys.servers.lists(),
      });
      queryClient.invalidateQueries({ queryKey: wireGuardKeys.dashboard() });
    },
  });
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Download peer configuration file
 */
export function useDownloadPeerConfig() {
  return useMutation({
    mutationFn: async (peerId: string) => {
      const response = await apiClient.get<WireGuardPeerConfigResponse>(
        `${API_BASE}/peers/${peerId}/config`,
      );
      const config = response.data;

      // Create blob and download
      const blob = new Blob([config.config_file], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${config.peer_name}.conf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      return config;
    },
  });
}

/**
 * Get peer QR code (future implementation)
 */
export function usePeerQRCode(peerId: string | undefined, enabled: boolean = false) {
  return useQuery({
    queryKey: [...wireGuardKeys.peers.all, "qr-code", peerId],
    queryFn: async () => {
      const response = await apiClient.get<WireGuardPeerQRCodeResponse>(
        `${API_BASE}/peers/${peerId}/qr-code`,
      );
      return response.data;
    },
    enabled: !!peerId && enabled,
    staleTime: Infinity,
  });
}
