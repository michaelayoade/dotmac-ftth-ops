/**
 * Network Diagnostics Hooks
 *
 * Custom hooks for performing network diagnostic operations:
 * - Disconnect RADIUS session
 * - Ping device
 * - Traceroute to device
 */

import { useMutation } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface DisconnectSessionRequest {
  username: string;
  acctsessionid?: string;
  nasipaddress?: string;
}

export interface PingRequest {
  host: string;
  count?: number;
}

export interface TracerouteRequest {
  host: string;
  maxHops?: number;
}

export interface PingResult {
  host: string;
  packets_sent: number;
  packets_received: number;
  packet_loss_percent: number;
  min_rtt: number;
  avg_rtt: number;
  max_rtt: number;
  output: string;
}

export interface TracerouteHop {
  hop_number: number;
  ip_address: string;
  hostname?: string;
  rtt1: number;
  rtt2: number;
  rtt3: number;
}

export interface TracerouteResult {
  host: string;
  hops: TracerouteHop[];
  output: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useNetworkDiagnostics() {
  const { toast } = useToast();

  // Disconnect RADIUS session
  const disconnectSession = useMutation({
    mutationFn: async ({ username, acctsessionid, nasipaddress }: DisconnectSessionRequest) => {
      const response = await apiClient.post(`/radius/sessions/disconnect`, {
        username,
        acctsessionid,
        nasipaddress,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      logger.info("RADIUS session disconnected", {
        username: variables.username,
        acctsessionid: variables.acctsessionid,
      });
      toast({
        title: "Session Disconnected",
        description: "The RADIUS session has been disconnected successfully.",
      });
    },
    onError: (error: any, variables) => {
      logger.error("Failed to disconnect RADIUS session", {
        username: variables.username,
        acctsessionid: variables.acctsessionid,
        error,
      });
      toast({
        title: "Failed to Disconnect Session",
        description:
          error.response?.data?.detail || "Unable to disconnect session. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Ping device
  const pingDevice = useMutation({
    mutationFn: async ({ host, count = 4 }: PingRequest): Promise<PingResult> => {
      const response = await apiClient.post("/diagnostics/ping", {
        host,
        count,
      });
      return response.data;
    },
    onSuccess: (data) => {
      logger.info("Ping completed", {
        host: data.host,
        packetLoss: data.packet_loss_percent,
      });
      toast({
        title: "Ping Completed",
        description: `${data.packets_received}/${data.packets_sent} packets received (${data.packet_loss_percent}% loss)`,
      });
    },
    onError: (error: any, variables) => {
      logger.error("Failed to ping device", {
        host: variables.host,
        error,
      });
      toast({
        title: "Ping Failed",
        description: error.response?.data?.detail || "Unable to ping device. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Traceroute to device
  const tracerouteDevice = useMutation({
    mutationFn: async ({ host, maxHops = 30 }: TracerouteRequest): Promise<TracerouteResult> => {
      const response = await apiClient.post("/diagnostics/traceroute", {
        host,
        max_hops: maxHops,
      });
      return response.data;
    },
    onSuccess: (data) => {
      logger.info("Traceroute completed", {
        host: data.host,
        hops: data.hops.length,
      });
      toast({
        title: "Traceroute Completed",
        description: `Reached ${data.host} in ${data.hops.length} hops`,
      });
    },
    onError: (error: any, variables) => {
      logger.error("Failed to traceroute device", {
        host: variables.host,
        error,
      });
      toast({
        title: "Traceroute Failed",
        description:
          error.response?.data?.detail || "Unable to traceroute device. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    // Mutations
    disconnectSession,
    pingDevice,
    tracerouteDevice,

    // Loading states
    isDisconnecting: disconnectSession.isPending,
    isPinging: pingDevice.isPending,
    isTracerouting: tracerouteDevice.isPending,

    // Combined loading state
    isLoading: disconnectSession.isPending || pingDevice.isPending || tracerouteDevice.isPending,

    // Result data
    pingResult: pingDevice.data,
    tracerouteResult: tracerouteDevice.data,
  };
}
